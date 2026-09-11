// Нээлттэй бүртгүүлэх хүсэлт: /signup хуудас ба POST /api/signup хоёулаа
// энэ цөмийг дуудна. Хүсэлт = `pending` төлөвтэй customers мөр — repo,
// Railway ЮУ Ч үүсэхгүй. Админ console-оос «Батлах» дарахад л provision
// (repo → Railway) эхэлнэ; «Татгалзах» бол мөр лавлагаанд үлдэнэ.
import { eq } from "drizzle-orm";

import { config } from "./config";
import { getCustomerBySlug, logEvent } from "./customers";
import { db } from "./db";
import { ensureSchema } from "./db/ensure";
import { customers, type Customer } from "./db/schema";
import { getCustomerRepo } from "./github";
import { notify } from "./notify";
import { assertSlugFree, dispatchProvision, normalizeProvisionInput, ProvisionError, SLUG_RE, type ProvisionInput } from "./provision";

export class SignupError extends Error {}

export interface SignupInput {
  /** Компанийн нэр */
  companyName: string;
  registerNo?: string;
  contactName: string;
  email: string;
  phone?: string;
  /** Хүссэн хаяг (entry-<код>) — хоосон бол нэрээс автоматаар */
  slug?: string;
  note?: string;
  /** Honeypot — бот бөглөвөл чимээгүй хаяна */
  website?: string;
}

// ── Кирилл → латин slug (console маягтын slugify-тай ИЖИЛ дүрэм) ─────────────
const CYR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",ө:"u",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
/** Хуулийн хэлбэрийн товчлол (ХХК, ХК, ТӨХК, LLC …) slug-д орохгүй */
const LEGAL_RE = /\b(ххк|хк|төхк|төүг|хзх|ббсб|онөаатүг|ноаатүг|тбб|llc|jsc|ltd|inc|co)\.?\b/gi;
export function slugify(s: string): string {
  return s.toLowerCase().replace(LEGAL_RE, " ").split("").map((c) => CYR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);
}

/** Нэрээс slug гаргаад, console/GitHub-д давхцвал -2, -3 … залгана. */
async function uniqueSlug(base: string): Promise<string> {
  let root = base.replace(/-+$/, "").slice(0, 28) || "company";
  if (root.length < 2) root = `${root}co`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!SLUG_RE.test(candidate)) continue;
    if (await getCustomerBySlug(candidate)) continue;
    if (await getCustomerRepo(candidate).catch(() => null)) continue;
    return candidate;
  }
  throw new SignupError("Код олдсонгүй — өөр код оруулна уу");
}

// ── Энгийн rate limit (нэг процесс, санах ойд): IP тутамд цагт 5 хүсэлт ────
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Хүсэлт бүртгэнэ → pending мөр. Админд мэдэгдэл (Telegram/webhook тохируулсан бол). */
export async function submitSignup(input: SignupInput, ip = "?"): Promise<Customer> {
  if ((input.website ?? "").trim()) throw new SignupError("Хүсэлт хүлээн авагдсангүй"); // honeypot
  const companyName = (input.companyName ?? "").trim();
  const contactName = (input.contactName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();
  const registerNo = (input.registerNo ?? "").trim();
  const note = (input.note ?? "").trim().slice(0, 2000);
  const wanted = (input.slug ?? "").trim().toLowerCase();

  if (companyName.length < 2 || companyName.length > 120) throw new SignupError("Компанийн нэр 2–120 тэмдэгт");
  if (contactName.length < 2) throw new SignupError("Холбоо барих хүний нэр хоосон байна");
  if (!EMAIL_RE.test(email)) throw new SignupError("Имэйл хаяг буруу");
  if (registerNo && !/^[0-9A-Za-zА-Яа-яӨөҮү-]{2,20}$/.test(registerNo)) throw new SignupError("Регистр / ТТД буруу");
  if (wanted && !SLUG_RE.test(wanted)) throw new SignupError("Хаяг зөвхөн жижиг латин үсэг, тоо, зураас (2–31 тэмдэгт)");
  if (rateLimited(ip)) throw new SignupError("Хэт олон хүсэлт — түр хүлээгээд дахин оролдоно уу");

  await ensureSchema();
  // Нэг имэйлээс хүлээгдэж буй хүсэлт байвал давхардуулахгүй
  const dup = await db.query.customers.findFirst({ where: eq(customers.contactEmail, email) });
  if (dup && dup.status === "pending") throw new SignupError("Энэ имэйлээр хүсэлт аль хэдийн хүлээгдэж байна — бид удахгүй холбогдоно");

  let slug: string;
  if (wanted) {
    if (await getCustomerBySlug(wanted)) throw new SignupError(`«${wanted}» хаяг завгүй — өөр код сонгоно уу`);
    if (await getCustomerRepo(wanted).catch(() => null)) throw new SignupError(`«${wanted}» хаяг завгүй — өөр код сонгоно уу`);
    slug = wanted;
  } else slug = await uniqueSlug(slugify(companyName));

  const [created] = await db
    .insert(customers)
    .values({
      slug,
      displayName: companyName,
      registerNo: registerNo || null,
      contactName,
      contactEmail: email,
      contactPhone: phone || null,
      githubRepo: `${config.owner}/${config.repoPrefix}${slug}`,
      status: "pending",
      source: "signup",
      requestNote: note || null,
      autoDeploy: true,
    })
    .returning();
  await logEvent(created.id, "request", `Бүртгүүлэх хүсэлт: ${contactName} · ${email}${phone ? ` · ${phone}` : ""}${note ? ` — ${note.slice(0, 200)}` : ""}`);
  const consoleUrl = config.self.publicUrl ? `${config.self.publicUrl}/customers/${slug}` : `/customers/${slug}`;
  void notify(`🆕 Бүртгүүлэх хүсэлт: ${companyName}\n${contactName} · ${email}${phone ? ` · ${phone}` : ""}${note ? `\n«${note.slice(0, 300)}»` : ""}\nБатлах: ${consoleUrl}`);
  return created;
}

export interface ApproveInput {
  /** Батлахдаа кодыг өөрчилж болно (repo нэр) */
  slug?: string;
  displayName?: string;
  githubUsers?: string;
  ref?: string;
  plan?: string;
  monthlyFee?: string;
  autoDeploy?: boolean | string;
  note?: string;
}

/** Хүсэлтийг батална: repo үүсгэх workflow dispatch → мөр `provisioning` (autoDeploy бол Railway дараа нь). */
export async function approveRequest(customer: Customer, input: ApproveInput = {}): Promise<Customer> {
  if (customer.status !== "pending" && customer.status !== "rejected")
    throw new SignupError(`«${customer.slug}» хүсэлт биш (${customer.status})`);
  const p = normalizeProvisionInput({
    slug: input.slug ?? customer.slug,
    displayName: input.displayName ?? customer.displayName,
    githubUsers: input.githubUsers,
    ref: input.ref,
    plan: input.plan ?? customer.plan,
    monthlyFee: input.monthlyFee ?? customer.monthlyFee,
    autoDeploy: input.autoDeploy ?? customer.autoDeploy,
  } satisfies ProvisionInput);
  await assertSlugFree(p.slug, customer.id);
  await dispatchProvision(p);
  const [next] = await db
    .update(customers)
    .set({
      slug: p.slug,
      displayName: p.displayName,
      githubRepo: `${config.owner}/${config.repoPrefix}${p.slug}`,
      githubUsers: p.githubUsers || null,
      seededRef: p.ref,
      plan: p.plan,
      monthlyFee: p.monthlyFee,
      autoDeploy: p.autoDeploy,
      status: "provisioning",
      decidedAt: new Date(),
      decisionNote: (input.note ?? "").trim() || null,
      deployError: null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customer.id))
    .returning();
  await logEvent(customer.id, "approved", `Хүсэлт батлагдав — repo үүсгэх ажил эхэллээ (core ${p.ref})${p.autoDeploy ? " · repo бэлэн болмогц Railway deploy" : ""}${p.slug !== customer.slug ? ` · код ${customer.slug} → ${p.slug}` : ""}`);
  return next;
}

/** Хүсэлтийг татгалзана — мөр `rejected` болж үлдэнэ (дараа нь батлах эсвэл устгаж болно). */
export async function rejectRequest(customer: Customer, reason?: string): Promise<Customer> {
  if (customer.status !== "pending") throw new SignupError(`«${customer.slug}» хүлээгдэж буй хүсэлт биш (${customer.status})`);
  const note = (reason ?? "").trim() || null;
  const [next] = await db
    .update(customers)
    .set({ status: "rejected", decidedAt: new Date(), decisionNote: note, updatedAt: new Date() })
    .where(eq(customers.id, customer.id))
    .returning();
  await logEvent(customer.id, "rejected", `Хүсэлт татгалзав${note ? `: ${note}` : ""}`);
  return next;
}

export { ProvisionError };
