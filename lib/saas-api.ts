// Core (SaaS) сервисийн платформын API клиент — /api/platform/subscriptions.
// Нэвтрэлт Bearer ENTRY_SAAS_API_KEY (core талд ENTRY_PLATFORM_API_KEY-тэй ижил утга).
// Core талд зөвхөн saas горимд нээлттэй (dedicated deploy → 404).

import { config } from "./config";
import type { SaasSubscriptionInput, SaasSubscriptionRow } from "./saas-subscriptions";

export class SaasApiError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "SaasApiError";
  }
}

export function saasApiConfigured(): boolean {
  return !!config.saas;
}

async function call<T>(method: "GET" | "PUT", body?: unknown): Promise<T> {
  const saas = config.saas;
  if (!saas) throw new SaasApiError("ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй (.env.example)");
  let response: Response;
  try {
    response = await fetch(`${saas.apiUrl}/api/platform/subscriptions`, {
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

export async function listSaasSubscriptions(): Promise<SaasSubscriptionRow[]> {
  const result = await call<{ rows: SaasSubscriptionRow[] }>("GET");
  return Array.isArray(result.rows) ? result.rows : [];
}

export async function getSaasSubscription(organizationId: string): Promise<SaasSubscriptionRow | null> {
  const rows = await listSaasSubscriptions();
  return rows.find((row) => row.organizationId === organizationId) ?? null;
}

export async function saveSaasSubscription(input: SaasSubscriptionInput, actor: string): Promise<{ organizationId: string; orgName: string }> {
  return call<{ organizationId: string; orgName: string }>("PUT", { ...input, actor });
}
