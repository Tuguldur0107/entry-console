"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { checkPassword, createSession, destroySession, requireSession } from "./auth";
import { getCustomerBySlug, logEvent } from "./customers";
import { provision } from "./provision";
import { approveRequest, rejectRequest, SignupError, submitSignup } from "./signup";
import { DeployError, deployNow, redeployNow } from "./deploy";
import { destroyCustomer, TeardownError } from "./teardown";
import { applyStatusTransition, LifecycleError } from "./lifecycle";
import { attachBackupsAndDomain } from "./deploy";
import { runMonitor } from "./monitor";
import { bootstrapSyncWorkflow, grantUpstreamAccess, revokeUpstreamAccess, UpstreamAccessError } from "./upstream-access";
import { createBackup, createCustomDomain, deleteCustomDomain, deleteOrphanVolumes } from "./railway";
import { config } from "./config";
import { enableMonitoringCore, SetupError } from "./monitoring-setup";
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
  if (error instanceof GitHubError || error instanceof DeployError || error instanceof TeardownError || error instanceof LifecycleError || error instanceof SetupError || error instanceof SignupError || error instanceof UpstreamAccessError) return error.message;
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

// ── Нээлттэй бүртгүүлэх хүсэлт (session ШААРДАХГҮЙ) → батлах / татгалзах ──────

/** /signup маягт → lib/signup.ts (REST /api/signup-тай ижил цөм). Амжилтад /signup/done руу. */
export async function submitSignupRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "?";
  try {
    await submitSignup(
      {
        companyName: text(formData, "company_name"),
        registerNo: text(formData, "register_no"),
        contactName: text(formData, "contact_name"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        slug: text(formData, "slug"),
        note: text(formData, "note"),
        website: text(formData, "website"),
      },
      ip
    );
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  redirect("/signup/done");
}

/** Хүсэлт батлах — маягтын талбаруудаар (код, багц, төлбөр, core ref, GitHub эрх, автомат deploy). */
export async function approveRequestAction(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Хүсэлт олдсонгүй" };
  let next: string;
  try {
    const approved = await approveRequest(customer, {
      slug: text(formData, "slug") || undefined,
      displayName: text(formData, "display_name") || undefined,
      githubUsers: text(formData, "github_users"),
      ref: text(formData, "ref"),
      plan: text(formData, "plan") || undefined,
      monthlyFee: text(formData, "monthly_fee") || undefined,
      autoDeploy: text(formData, "auto_deploy"),
      note: text(formData, "note"),
    });
    next = approved.slug;
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  revalidatePath("/");
  revalidatePath("/customers");
  if (next !== slug) redirect(`/customers/${next}`);
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: "Батлагдлаа — repo үүсгэх ажил эхэллээ (~1 мин), дараа нь Railway deploy" };
}

/** Самбараас нэг товчоор батлах — хүсэлтийн утгууд + сүүлийн release + автомат deploy. */
export async function approveRequestQuick(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Хүсэлт олдсонгүй" };
  try {
    const ref = (await getLatestRelease().catch(() => null))?.tagName ?? "main";
    await approveRequest(customer, { ref, autoDeploy: true });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: `${customer.displayName} батлагдлаа — repo, дараа нь Railway автоматаар` };
}

export async function rejectRequestAction(slug: string, reason: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Хүсэлт олдсонгүй" };
  try {
    await rejectRequest(customer, reason);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: "Татгалзлаа" };
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

  let transitionNote: string | null = null;
  if (status !== customer.status) {
    try {
      transitionNote = await applyStatusTransition(customer, status);
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  }
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
  return { ok: true, message: transitionNote ? `Хадгалагдлаа · ${transitionNote}` : "Хадгалагдлаа" };
}

// ── Шинэчлэлт авах эрх (захиалгын гарц) ──────────────────────────────────────

/** Эрх олгоно / түлхүүрийг шинэчилнэ (core дээр deploy key + repo-д secret). */
export async function grantUpstream(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await grantUpstreamAccess(customer);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  revalidatePath(`/customers/${slug}`);
  revalidatePath("/");
  return { ok: true, message: customer.upstreamAccess ? "Түлхүүр шинэчлэгдлээ" : "Эрх олгогдлоо — шинэчлэлт ирнэ" };
}

/** Эрх цуцална — байгаа код, deploy хэвээр; зөвхөн шинэ хувилбар ирэхээ болино. */
export async function revokeUpstream(slug: string, reason: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await revokeUpstreamAccess(customer, reason);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  revalidatePath(`/customers/${slug}`);
  revalidatePath("/");
  return { ok: true, message: "Цуцлагдлаа — байгаа код нь ажилласаар байна" };
}

/** Харилцагчийн sync workflow-г core-ийнхтэй тэнцүүлнэ (хуучин суулгацыг засна). */
export async function bootstrapWorkflow(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    const { updated, checked, permissions } = await bootstrapSyncWorkflow(customer);
    revalidatePath(`/customers/${slug}`);
    const perm = permissions === "already" ? "" : ` · Actions эрх: ${permissions}`;
    return {
      ok: true,
      message: (updated.length ? `Шинэчлэгдлээ: ${updated.join(", ")}` : `${checked} workflow аль хэдийн core-тэй ижил`) + perm,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Харилцагчийн repo дээр upstream-sync.yml-ийг заасан ref-ээр ажиллуулна. */
export async function syncCustomer(slug: string, ref?: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  if (!customer.upstreamAccess)
    return { ok: false, error: "Шинэчлэлт авах эрх цуцлагдсан — эхлээд эрхийг сэргээнэ үү" };
  try {
    // Sync эхлэхийн ӨМНӨ workflow файлуудыг тэнцүүлнэ: тэгвэл sync салбарт
    // workflow-ийн ӨӨРЧЛӨЛТ үлдэхгүй тул GITHUB_TOKEN-оор push хийгдэнэ
    // (үгүй бол GitHub «workflows permission» гэж татгалзана).
    await bootstrapSyncWorkflow(customer).catch(() => undefined);
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
    // Эрх цуцлагдсан харилцагч руу шинэчлэлт явуулахгүй (захиалгын гарц)
    if (!row.upstreamAccess) {
      skipped += 1;
      continue;
    }
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

/**
 * Харилцагчийг БҮРЭН устгана (Railway app + DB, GitHub repo, бүртгэл).
 * Баталгаажуулалт: хэрэглэгч кодыг нь яг бичсэн байх ёстой.
 */
export async function destroyCustomerAction(slug: string, confirmSlug: string): Promise<ActionResult> {
  await requireSession();
  if (confirmSlug.trim() !== slug) return { ok: false, error: "Баталгаажуулахын тулд кодыг яг бичнэ" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await destroyCustomer(customer);
  } catch (error) {
    revalidatePath(`/customers/${slug}`);
    return { ok: false, error: errorText(error) };
  }
  revalidatePath("/");
  revalidatePath("/customers");
  redirect("/customers?deleted=" + encodeURIComponent(slug));
}

/** Төлөв хурдан солих (Идэвхтэй ↔ Түр зогсоох ↔ Архив). */
export async function setCustomerStatus(slug: string, status: CustomerStatus): Promise<ActionResult> {
  await requireSession();
  if (!CUSTOMER_STATUSES.includes(status)) return { ok: false, error: "Төлөв буруу" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  let note: string | null = null;
  try {
    note = await applyStatusTransition(customer, status);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  await db.update(customers).set({ status, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  await logEvent(customer.id, "status", `Төлөв: ${customer.status} → ${status}`);
  revalidatePath(`/customers/${slug}`);
  revalidatePath("/");
  revalidatePath("/customers");
  return { ok: true, message: note ? `Төлөв солигдлоо · ${note}` : "Төлөв солигдлоо" };
}

/** Авто sync toggle. */
export async function setAutoSync(slug: string, on: boolean): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  await db.update(customers).set({ autoSync: on, syncNote: null, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  await logEvent(customer.id, "sync", on ? "Авто sync асаав: шинэ release → PR → шалгалт давбал merge" : "Авто sync унтраав");
  revalidatePath(`/customers/${slug}`);
  return { ok: true, message: on ? "Авто sync асаалттай" : "Авто sync унтраалттай" };
}

/** Backup хуваарь/custom domain нөхөх (хуучин харилцагч эсвэл унасан алхам). */
export async function attachExtras(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await attachBackupsAndDomain(customer);
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: "Backup хуваарь / domain тохируулагдлаа" };
  } catch (error) {
    revalidatePath(`/customers/${slug}`);
    return { ok: false, error: errorText(error) };
  }
}

/** Гараар backup авах (Railway volume snapshot). */
export async function backupNow(slug: string): Promise<ActionResult> {
  await requireSession();
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  if (!customer.railwayVolumeInstanceId) return { ok: false, error: "Volume бүртгэлгүй — эхлээд «Backup идэвхжүүлэх»" };
  try {
    await createBackup(customer.railwayVolumeInstanceId, `manual-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
    await logEvent(customer.id, "deploy", "Гараар backup авлаа");
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: "Backup эхэллээ (1–2 мин)" };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Custom domain гараар тавих / солих. */
export async function setCustomDomainAction(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireSession();
  const domain = text(formData, "domain").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { ok: false, error: "Domain буруу (жишээ: govi.entry.mn)" };
  const customer = await getCustomerBySlug(slug);
  if (!customer) return { ok: false, error: "Харилцагч олдсонгүй" };
  if (!customer.railwayProjectId || !customer.railwayEnvironmentId || !customer.railwayServiceId) return { ok: false, error: "Эхлээд Railway-д deploy хий" };
  try {
    if (customer.customDomainId) await deleteCustomDomain(customer.customDomainId).catch(() => {});
    const d = await createCustomDomain(customer.railwayProjectId, customer.railwayEnvironmentId, customer.railwayServiceId, domain);
    const cname = d.dns.find((r) => r.recordType === "CNAME") ?? d.dns[0];
    await db.update(customers).set({ customDomain: d.domain, customDomainId: d.id, dnsTarget: cname?.requiredValue ?? null, customDomainVerified: d.verified, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await logEvent(customer.id, "deploy", `Custom domain ${d.domain} — DNS ${cname?.recordType ?? "CNAME"} → ${cname?.requiredValue ?? "?"}`);
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: `Domain үүслээ. DNS: ${cname?.recordType ?? "CNAME"} ${d.domain} → ${cname?.requiredValue ?? "?"}` };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Хяналтыг гараар нэг удаа ажиллуулах. */
export async function runMonitorNow(): Promise<ActionResult> {
  await requireSession();
  try {
    const s = await runMonitor();
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: `${s.checked} шалгав · унасан ${s.down.length} · сэргэсэн ${s.recovered.length} · merge ${s.merged.length} · sync ${s.synced.length} · мэдэгдэл ${s.alertsSent}${s.errors.length ? ` · алдаа: ${s.errors.join("; ")}` : ""}` };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/**
 * Хяналтын cron service үүсгэнэ (Railway, 5 мин тутам). CONSOLE_API_KEY байхгүй
 * бол console-ийн өөрийн service дээр үүсгэж тавина (console дахин deploy хийгдэнэ).
 */
export async function enableMonitoring(): Promise<ActionResult> {
  await requireSession();
  try {
    const r = await enableMonitoringCore();
    revalidatePath("/settings");
    return { ok: true, message: r.message };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Ямар ч service-д холбоогүй volume-уудыг устгана. */
export async function cleanupOrphanVolumes(): Promise<ActionResult> {
  await requireSession();
  const { projectId, environmentId } = config.self;
  const p = process.env.RAILWAY_PROJECT_ID ?? projectId;
  const e = process.env.RAILWAY_ENVIRONMENT_ID ?? environmentId;
  if (!p || !e) return { ok: false, error: "RAILWAY_PROJECT_ID алга" };
  try {
    const n = await deleteOrphanVolumes(p, e);
    revalidatePath("/settings");
    return { ok: true, message: n ? `${n} салангид volume устгав` : "Салангид volume алга" };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
