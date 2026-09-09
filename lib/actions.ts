"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { checkPassword, createSession, destroySession, requireSession } from "./auth";
import { getCustomerBySlug, logEvent } from "./customers";
import { provision } from "./provision";
import { DeployError, deployNow, redeployNow } from "./deploy";
import { db } from "./db";
import {
  CUSTOMER_PLANS,
  CUSTOMER_STATUSES,
  customers,
  type CustomerPlan,
  type CustomerStatus,
} from "./db/schema";
import {
  dispatchWorkflow,
  fetchHealth,
  getCustomerRepo,
  getDefaultBranch,
  getLatestRelease,
  GitHubError,
  inviteCollaborator,
  setVariable,
} from "./github";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function errorText(error: unknown): string {
  if (error instanceof GitHubError || error instanceof DeployError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = text(formData, "password");
  if (!password || !checkPassword(password)) return { ok: false, error: "Нууц үг буруу" };
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** «Харилцагч нэмэх» маягт → lib/provision.ts (REST /api/customers-тай ижил цөм). */
export async function provisionCustomer(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  let slug: string;
  try {
    const created = await provision({
      slug: text(formData, "slug"),
      displayName: text(formData, "display_name"),
      registerNo: text(formData, "register_no"),
      contactName: text(formData, "contact_name"),
      contactEmail: text(formData, "contact_email"),
      contactPhone: text(formData, "contact_phone"),
      githubUsers: text(formData, "github_users"),
      appUrl: text(formData, "app_url"),
      ref: text(formData, "ref"),
      plan: text(formData, "plan"),
      monthlyFee: text(formData, "monthly_fee"),
      autoDeploy: text(formData, "auto_deploy"),
    });
    slug = created.slug;
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  redirect(`/customers/${slug}`);
}

/** Бизнесийн мэдээлэл засах — гэрээ, холбоо барих, багц, төлөв. */
export async function updateCustomer(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };

  const displayName = text(formData, "display_name");
  const plan = text(formData, "plan") as CustomerPlan;
  const status = text(formData, "status") as CustomerStatus;
  const monthlyFee = text(formData, "monthly_fee") || "0";
  const billingStartsAt = text(formData, "billing_starts_at");
  const appUrl = text(formData, "app_url");
  if (!displayName) return { ok: false, error: "Нэр хоосон байна" };
  if (!CUSTOMER_PLANS.includes(plan)) return { ok: false, error: "Багц буруу" };
  if (!CUSTOMER_STATUSES.includes(status)) return { ok: false, error: "Төлөв буруу" };
  if (!/^\d+(\.\d{1,2})?$/.test(monthlyFee)) return { ok: false, error: "Сарын төлбөр тоо байх ёстой" };
  if (billingStartsAt && !/^\d{4}-\d{2}-\d{2}$/.test(billingStartsAt))
    return { ok: false, error: "Огноо YYYY-MM-DD" };
  if (appUrl && !/^https?:\/\//.test(appUrl)) return { ok: false, error: "URL https://-ээр эхлэх ёстой" };

  await db
    .update(customers)
    .set({
      displayName,
      registerNo: text(formData, "register_no") || null,
      contactName: text(formData, "contact_name") || null,
      contactEmail: text(formData, "contact_email") || null,
      contactPhone: text(formData, "contact_phone") || null,
      appUrl: appUrl || null,
      plan,
      status,
      monthlyFee,
      billingStartsAt: billingStartsAt || null,
      notes: text(formData, "notes") || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customer.id));

  if (status !== customer.status)
    await logEvent(customer.id, "status", `Төлөв: ${customer.status} → ${status}`);
  if (plan !== customer.plan || monthlyFee !== customer.monthlyFee)
    await logEvent(customer.id, "billing", `Багц ${plan}, сарын төлбөр ${monthlyFee} ${customer.currency}`);

  // Repo variable-ийг мөн шинэчилнэ (харилцагчийн repo талаас ч харагдана).
  if (appUrl !== (customer.appUrl ?? "")) {
    try {
      await setVariable(customer.githubRepo, "ENTRY_APP_URL", appUrl);
    } catch {
      /* repo хараахан үүсээгүй байж болно — DB-д хадгалагдсан нь хангалттай */
    }
  }
  revalidatePath(`/customers/${slug}`);
  revalidatePath("/");
  return { ok: true, message: "Хадгалагдлаа" };
}

/** Харилцагчийн repo дээр upstream-sync.yml-ийг заасан ref-ээр ажиллуулна. */
export async function syncCustomer(slug: string, ref?: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    const target = ref?.trim() || (await getLatestRelease())?.tagName || "main";
    const branch = await getDefaultBranch(customer.githubRepo);
    await dispatchWorkflow(customer.githubRepo, "upstream-sync.yml", branch, { ref: target });
    await logEvent(customer.id, "sync", `Upstream sync эхэллээ: ${target}`);
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: `Sync эхэллээ: ${target} → PR нээгдэнэ (1–2 мин)` };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404)
      return { ok: false, error: "Repo эсвэл upstream-sync.yml олдсонгүй — repo үүсч дуусаагүй байж болно" };
    return { ok: false, error: errorText(error) };
  }
}

export async function inviteUser(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const username = text(formData, "username").replace(/^@/, "");
  const permission = text(formData, "permission") || "push";
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) return { ok: false, error: "GitHub нэр буруу" };
  if (!["pull", "push", "admin"].includes(permission)) return { ok: false, error: "Эрх буруу" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await inviteCollaborator(customer.githubRepo, username, permission as "pull" | "push" | "admin");
    await logEvent(customer.id, "invite", `${username} уригдав (${permission})`);
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: `${username} уригдлаа (${permission})` };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function addNote(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const message = text(formData, "message");
  if (!message) return { ok: false, error: "Тэмдэглэл хоосон" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  await logEvent(customer.id, "note", message);
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: "Нэмэгдлээ" };
}


/** Бүх идэвхтэй харилцагчид core-ийн сүүлийн release-ийг sync хийх PR нээнэ. */
export async function syncAllCustomers(): Promise<ActionResult> {
  await requireSession();
  let target: string | undefined;
  let rows: (typeof customers.$inferSelect)[];
  try {
    target = (await getLatestRelease())?.tagName;
    if (!target) return { ok: false, error: "Core-д release алга" };
    rows = await db.select().from(customers).where(eq(customers.status, "active"));
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  let started = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const row of rows) {
    // Аль хэдийн target хувилбар дээр байгаа (health.version таарсан) бол алгасна —
    // самбарын товчны тоолуур (behind !== false || health алга)-тай ижил дүрэм.
    const health = await fetchHealth(row.appUrl);
    if (health?.ok && health.version && `v${health.version}`.replace(/^vv/, "v") === target) {
      skipped += 1;
      continue;
    }
    try {
      const branch = await getDefaultBranch(row.githubRepo);
      await dispatchWorkflow(row.githubRepo, "upstream-sync.yml", branch, { ref: target });
      await logEvent(row.id, "sync", `Бөөн sync: ${target}`);
      started += 1;
    } catch (error) {
      failed.push(`${row.slug}: ${errorText(error)}`);
    }
  }
  revalidatePath("/");
  const note = `${started} харилцагчид ${target} sync эхэллээ${skipped ? ` · ${skipped} аль хэдийн шинэ` : ""}${failed.length ? `; алдаа: ${failed.join(", ")}` : ""}`;
  return started > 0 || failed.length === 0 ? { ok: true, message: note } : { ok: false, error: failed.join("; ") };
}

/** Railway дээр service хос (app + Postgres) үүсгэж deploy эхлүүлнэ. */
export async function deployCustomerToRailway(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    const repo = await getCustomerRepo(slug);
    const next = await deployNow(customer, !!repo?.pushedAt);
    revalidatePath(`/customers/${slug}`);
    revalidatePath("/");
    return { ok: true, message: `Deploy эхэллээ → ${next.appUrl} (build 3–5 мин)` };
  } catch (error) {
    revalidatePath(`/customers/${slug}`);
    return { ok: false, error: errorText(error) };
  }
}

/** Байгаа Railway service-ийг дахин deploy. */
export async function redeployCustomer(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await redeployNow(customer);
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: "Дахин deploy эхэллээ (3–5 мин)" };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Repo бэлэн болмогц автоматаар deploy хийх тохиргоо. */
export async function setAutoDeploy(slug: string, on: boolean): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  await db.update(customers).set({ autoDeploy: on, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: on ? "Repo бэлэн болмогц deploy хийнэ" : "Автомат deploy унтарлаа" };
}

/** Төлөв хурдан солих (Идэвхтэй ↔ Түр зогсоох ↔ Архив). */
export async function setCustomerStatus(slug: string, status: CustomerStatus): Promise<ActionResult> {
  await requireSession();
  if (!CUSTOMER_STATUSES.includes(status)) return { ok: false, error: "Төлөв буруу" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  await db.update(customers).set({ status, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  await logEvent(customer.id, "status", `Төлөв: ${customer.status} → ${status}`);
  revalidatePath(`/customers/${slug}`);
  revalidatePath("/");
  revalidatePath("/customers");
  return { ok: true, message: "Төлөв солигдлоо" };
}
