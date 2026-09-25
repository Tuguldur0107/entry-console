// Core (SaaS) сервисийн платформын API клиент — /api/platform/subscriptions.
// Нэвтрэлт Bearer ENTRY_SAAS_API_KEY (core талд ENTRY_PLATFORM_API_KEY-тэй ижил утга).
// Core талд зөвхөн saas горимд нээлттэй (dedicated deploy → 404).

import { config } from "./config";
import type { SaasBillingPayment } from "./saas-billing";
import { withSeatPrice } from "./saas-subscriptions";
import type {
  SaasOrgDetail,
  SaasSupportRole,
  SaasSupportSession,
} from "./saas-orgs";
import type {
  SaasPlanPriceInput,
  SaasPlanPricePeriod,
  SaasPlanPrices,
  SaasSubscriptionInput,
  SaasSubscriptionRow,
} from "./saas-subscriptions";

export class SaasApiError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "SaasApiError";
  }
}

export function saasApiConfigured(): boolean {
  return !!config.saas;
}

async function call<T>(path: string, method: "GET" | "PUT" | "POST" | "DELETE", body?: unknown): Promise<T> {
  const saas = config.saas;
  if (!saas) throw new SaasApiError("ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй (.env.example)");
  let response: Response;
  try {
    response = await fetch(`${saas.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${saas.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new SaasApiError(`SaaS сервис хүрэхгүй байна (${saas.apiUrl}): ${error instanceof Error ? error.message : String(error)}`);
  }
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new SaasApiError(`SaaS API JSON биш хариу өгөв (HTTP ${response.status})`, response.status);
  }
  if (!response.ok || json.ok === false) {
    const hint =
      response.status === 401 ? " — ENTRY_SAAS_API_KEY нь core-ийн ENTRY_PLATFORM_API_KEY-тэй ижил эсэхийг шалга"
      : response.status === 404 ? " — core сервис saas горимд биш (ENTRY_DEPLOYMENT_MODE=saas)"
      : response.status === 503 ? " — core талд ENTRY_PLATFORM_API_KEY тавиагүй"
      : "";
    throw new SaasApiError(`${json.error ?? `HTTP ${response.status}`}${hint}`, response.status);
  }
  return json as T;
}

const SUBSCRIPTIONS = "/api/platform/subscriptions";
const PLAN_PRICES = "/api/platform/plan-prices";

export async function listSaasSubscriptions(): Promise<SaasSubscriptionRow[]> {
  const result = await call<{ rows: SaasSubscriptionRow[] }>(SUBSCRIPTIONS, "GET");
  // Хилийн цэгцлэлт: core-ийн ХУУЧИН хувилбар үнийн талбаргүй хариу буцаана
  // (Console эхлээд deploy хийгдвэл). undefined → null, тоо ЗОХИОХГҮЙ.
  return (Array.isArray(result.rows) ? result.rows : []).map((row) => ({
    ...row,
    pricePerSeatMnt: row.pricePerSeatMnt ?? null,
    pricePerSeatOverrideMnt: row.pricePerSeatOverrideMnt ?? null,
    monthlyAmountMnt: row.monthlyAmountMnt ?? null,
  }));
}

export async function getSaasSubscription(organizationId: string): Promise<SaasSubscriptionRow | null> {
  const rows = await listSaasSubscriptions();
  return rows.find((row) => row.organizationId === organizationId) ?? null;
}

export async function saveSaasSubscription(input: SaasSubscriptionInput, actor: string): Promise<{ organizationId: string; orgName: string }> {
  return call<{ organizationId: string; orgName: string }>(SUBSCRIPTIONS, "PUT", { ...input, actor });
}

/**
 * Зөвхөн ТУСГАЙ ҮНИЙГ солино (үнийн хуудаснаас).
 * core-ийн PUT нь мөрийг бүтнээр солидог тул эхлээд одоогийн мөрийг уншиж,
 * бусад талбарыг хэвээр буцаана. Console нэг админтай тул read-modify-write
 * хангалттай — зэрэгцээ засварын уралдаан бодит эрсдэл биш.
 */
export async function setOrgSeatPrice(
  organizationId: string,
  pricePerSeatMnt: number | null,
  actor: string
): Promise<{ orgName: string }> {
  const rows = await listSaasSubscriptions();
  const row = rows.find((candidate) => candidate.organizationId === organizationId);
  if (!row) throw new SaasApiError("Байгууллага олдсонгүй");
  const saved = await saveSaasSubscription(withSeatPrice(row, pricePerSeatMnt), actor);
  return { orgName: saved.orgName || row.orgName };
}

export type PlanPricesResult = {
  periods: SaasPlanPricePeriod[];
  prices: SaasPlanPrices;
  defaults: SaasPlanPrices;
  /** core-ийн Улаанбаатарын өнөөдөр (YYYY-MM-DD) — «мөрдөж буй» шошго үүгээр. */
  today: string;
};

function normalize(result: Partial<PlanPricesResult>): PlanPricesResult {
  return {
    periods: Array.isArray(result.periods) ? result.periods : [],
    prices: result.prices ?? {},
    defaults: result.defaults ?? {},
    today: result.today ?? new Date().toISOString().slice(0, 10),
  };
}

/** Багцын үнийн ТҮҮХ + тухайн өдрийн бодит үнэ + кодын default. */
export async function listPlanPrices(): Promise<PlanPricesResult> {
  return normalize(await call<Partial<PlanPricesResult>>(PLAN_PRICES, "GET"));
}

/** Шинэ үнийн үе нэмэх; хугацаагүй өмнөх үе автоматаар хаагдвал `closed` ирнэ. */
export async function addPlanPricePeriod(
  input: SaasPlanPriceInput,
  actor: string
): Promise<PlanPricesResult & { closed: string | null; added: string }> {
  const result = await call<Partial<PlanPricesResult> & { closed: string | null; added: string }>(
    PLAN_PRICES,
    "POST",
    { ...input, actor }
  );
  return { ...normalize(result), closed: result.closed ?? null, added: result.added ?? "" };
}

export async function deletePlanPricePeriod(
  id: string,
  actor: string
): Promise<PlanPricesResult & { removed: string }> {
  const result = await call<Partial<PlanPricesResult> & { removed: string }>(PLAN_PRICES, "DELETE", { id, actor });
  return { ...normalize(result), removed: result.removed ?? "" };
}

// ── Байгууллагын дэлгэрэнгүй + дэмжлэгийн хандалт ───────────────────────────

const ORGANIZATIONS = "/api/platform/organizations";
const SUPPORT_SESSIONS = "/api/platform/support-sessions";

/**
 * Байгууллагын дэлгэрэнгүй. Core-ийн ХУУЧИН хувилбар энэ замыг мэдэхгүй
 * (404) — тэр үед null буцаана, Console нь багцын хэсгээ харуулсаар байна
 * (хилийн цэгцлэлт: жагсаалтын үнийн талбартай ИЖИЛ зарчим).
 */
export async function getSaasOrgDetail(organizationId: string): Promise<SaasOrgDetail | null> {
  try {
    const result = await call<{ org: SaasOrgDetail }>(
      `${ORGANIZATIONS}?id=${encodeURIComponent(organizationId)}`,
      "GET"
    );
    return result.org ?? null;
  } catch (error) {
    if (error instanceof SaasApiError && error.status === 404) return null;
    throw error;
  }
}

export type IssuedSupportLink = {
  id: string;
  url: string;
  organizationId: string;
  orgName: string;
  email: string;
  role: SaasSupportRole;
  expiresAt: string;
  linkTtlMinutes: number;
};

/** Дэмжлэгийн линк олгох — core тал нь и-мэйлээр Entry данс олж уяна. */
export async function issueSupportSession(
  input: { organizationId: string; email: string; role: SaasSupportRole; reason: string | null },
  actor: string
): Promise<IssuedSupportLink> {
  return call<IssuedSupportLink>(SUPPORT_SESSIONS, "POST", { ...input, actor });
}

export async function listSupportSessions(
  organizationId: string,
  limit = 20
): Promise<SaasSupportSession[]> {
  const result = await call<{ rows: SaasSupportSession[] }>(
    `${SUPPORT_SESSIONS}?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`,
    "GET"
  );
  return Array.isArray(result.rows) ? result.rows : [];
}

/** Идэвхтэй сессийг ТАСЛАХ — оператор гарахаа мартсан үед Console-оос. */
export async function endSupportSession(id: string): Promise<void> {
  await call<{ ok: true }>(`${SUPPORT_SESSIONS}?id=${encodeURIComponent(id)}`, "DELETE");
}

// ── Багцын QPay төлбөр ────────────────────────────────────────────────────

const BILLING_PAYMENTS = "/api/platform/billing-payments";

/**
 * Багцын QPay төлбөрүүд (шинэ нь эхэнд). Core-ийн ХУУЧИН хувилбар энэ замыг
 * мэдэхгүй (404) — хоосон жагсаалт буцаана (хилийн цэгцлэлт).
 */
export async function listSaasBillingPayments(
  filter: { organizationId?: string; limit?: number } = {}
): Promise<SaasBillingPayment[]> {
  const params = new URLSearchParams();
  if (filter.organizationId) params.set("organizationId", filter.organizationId);
  if (filter.limit) params.set("limit", String(filter.limit));
  const query = params.toString();
  try {
    const result = await call<{ rows: SaasBillingPayment[] }>(`${BILLING_PAYMENTS}${query ? `?${query}` : ""}`, "GET");
    return Array.isArray(result.rows) ? result.rows : [];
  } catch (error) {
    if (error instanceof SaasApiError && error.status === 404) return [];
    throw error;
  }
}
