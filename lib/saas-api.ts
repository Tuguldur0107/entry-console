// Core (SaaS) сервисийн платформын API клиент — /api/platform/subscriptions.
// Нэвтрэлт Bearer ENTRY_SAAS_API_KEY (core талд ENTRY_PLATFORM_API_KEY-тэй ижил утга).
// Core талд зөвхөн saas горимд нээлттэй (dedicated deploy → 404).

import { config } from "./config";
import type {
  SaasPlanId,
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
