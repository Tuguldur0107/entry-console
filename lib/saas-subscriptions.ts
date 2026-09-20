// SaaS багцын ЦЭВЭР давхарга — fetch, DB, session БАЙХГҮЙ (тесттэй).
// Багц/статусын жагсаалт core-ийн lib/billing/plans.ts-тэй ИЖИЛ байх ёстой —
// core талд шинэ багц нэмэгдвэл энд ч нэмнэ (API validation core-д хийгдэнэ,
// энд зөвхөн харуулах шошго + формын урьдчилсан шалгалт).

export type SaasPlanId = "trial" | "standard" | "platform" | "enterprise" | "dedicated";
export type SaasSubscriptionStatus = "trialing" | "active" | "past_due" | "suspended" | "cancelled";

/** core: PlatformSubscriptionRow (lib/billing/platform.ts) — API-ийн JSON хэлбэр. */
export type SaasSubscriptionRow = {
  organizationId: string;
  orgName: string;
  registryNo: string | null;
  /** YYYY-MM-DD */
  createdAt: string;
  memberCount: number;
  ownerEmail: string | null;
  planId: SaasPlanId;
  status: SaasSubscriptionStatus;
  /** null = багцын default суудал */
  seats: number | null;
  seatsUsed: number;
  writable: boolean;
  readOnlyReason: string | null;
  daysLeft: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  overrides: unknown;
  note: string | null;
  /** organization_subscriptions мөр бий юу (үгүй бол default trial/standard) */
  hasRow: boolean;
  updatedAt: string | null;
};

/** PUT /api/platform/subscriptions body (actor-гүй). */
export type SaasSubscriptionInput = {
  organizationId: string;
  planId: SaasPlanId;
  status: SaasSubscriptionStatus;
  seats: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  overrides: unknown;
  note: string | null;
};

export const SAAS_PLAN_LABELS: Record<SaasPlanId, string> = {
  trial: "Туршилт",
  standard: "Standard",
  platform: "Platform",
  enterprise: "Enterprise",
  dedicated: "Тусдаа сервис",
};

/** Console-оос ОНООЖ болох багцууд — `dedicated` нь лицензээр (тусдаа deploy), SaaS-д биш. */
export const SAAS_ASSIGNABLE_PLANS: SaasPlanId[] = ["trial", "standard", "platform", "enterprise"];

export const SAAS_STATUS_LABELS: Record<SaasSubscriptionStatus, string> = {
  trialing: "Туршилт",
  active: "Идэвхтэй",
  past_due: "Төлбөр хоцорсон",
  suspended: "Түр зогсоосон",
  cancelled: "Цуцлагдсан",
};

export const SAAS_STATUSES: SaasSubscriptionStatus[] = ["trialing", "active", "past_due", "suspended", "cancelled"];

export const SAAS_STATUS_BADGE: Record<SaasSubscriptionStatus, string> = {
  trialing: "badge-info",
  active: "badge-success",
  past_due: "badge-warning",
  suspended: "badge-danger",
  cancelled: "badge-muted",
};

export function isSaasPlanId(value: unknown): value is SaasPlanId {
  return typeof value === "string" && value in SAAS_PLAN_LABELS;
}

export function isSaasStatus(value: unknown): value is SaasSubscriptionStatus {
  return typeof value === "string" && (SAAS_STATUSES as string[]).includes(value);
}

/** Жагсаалтын шүүлтүүр: `status` = статус эсвэл "readonly" эсвэл "" (бүгд); `q` = нэр/ТТД/и-мэйл. */
export type SaasListFilter = { status?: string; q?: string };

export function filterSaasRows(rows: SaasSubscriptionRow[], filter: SaasListFilter): SaasSubscriptionRow[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const status = (filter.status ?? "").trim();
  return rows.filter((row) => {
    if (status === "readonly" && row.writable) return false;
    if (status && status !== "readonly" && row.status !== status) return false;
    if (!q) return true;
    return [row.orgName, row.registryNo ?? "", row.ownerEmail ?? "", row.organizationId]
      .some((field) => field.toLowerCase().includes(q));
  });
}

export type SaasSummary = {
  total: number;
  trialing: number;
  active: number;
  pastDue: number;
  suspended: number;
  cancelled: number;
  /** Бичих эрхгүй (trial дууссан / grace дууссан / зогсоосон) */
  readOnly: number;
  /** ≤7 хоногт trial эсвэл grace дуусах */
  endingSoon: number;
  /** Суудлын лимит хэтэрсэн (seatsUsed > seats) */
  overSeats: number;
};

export function summarizeSaasRows(rows: SaasSubscriptionRow[], soonDays = 7): SaasSummary {
  const summary: SaasSummary = {
    total: rows.length, trialing: 0, active: 0, pastDue: 0, suspended: 0, cancelled: 0,
    readOnly: 0, endingSoon: 0, overSeats: 0,
  };
  for (const row of rows) {
    if (row.status === "trialing") summary.trialing++;
    else if (row.status === "active") summary.active++;
    else if (row.status === "past_due") summary.pastDue++;
    else if (row.status === "suspended") summary.suspended++;
    else if (row.status === "cancelled") summary.cancelled++;
    if (!row.writable) summary.readOnly++;
    if (row.writable && row.daysLeft !== null && row.daysLeft <= soonDays) summary.endingSoon++;
    if (row.seats !== null && row.seatsUsed > row.seats) summary.overSeats++;
  }
  return summary;
}

/** Мөрийн "хугацаа" багана — trial / grace-ийн үлдсэн хоног, эсвэл шалтгаан. */
export function describeSaasDeadline(row: SaasSubscriptionRow): { text: string; tone: "" | "warning" | "danger" } {
  if (!row.writable) return { text: row.readOnlyReason ?? "Зөвхөн унших", tone: "danger" };
  if (row.daysLeft === null) return { text: "—", tone: "" };
  if (row.daysLeft <= 0) return { text: "Өнөөдөр дуусна", tone: "danger" };
  const what = row.status === "trialing" ? "trial" : row.status === "past_due" ? "grace" : "хугацаа";
  return { text: `${row.daysLeft} хоног (${what})`, tone: row.daysLeft <= 7 ? "warning" : "" };
}

/** Суудал багана: ашигласан / оноосон (эсвэл багцын default). */
export function describeSaasSeats(row: SaasSubscriptionRow): { text: string; over: boolean } {
  const paid = row.seats === null ? "default" : String(row.seats);
  return { text: `${row.seatsUsed} / ${paid}`, over: row.seats !== null && row.seatsUsed > row.seats };
}

export const SAAS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Формын утгууд (бүгд string) → API input; алдаа монголоор. */
export function parseSaasSubscriptionForm(fields: Record<string, string>): { ok: true; input: SaasSubscriptionInput } | { ok: false; error: string } {
  const get = (key: string) => (fields[key] ?? "").trim();
  const organizationId = get("organization_id");
  if (!organizationId) return { ok: false, error: "Байгууллагын ID хоосон" };
  const planId = get("plan_id");
  if (!isSaasPlanId(planId) || !SAAS_ASSIGNABLE_PLANS.includes(planId))
    return { ok: false, error: "Багц буруу — trial / standard / platform / enterprise-ийн аль нэг" };
  const status = get("status");
  if (!isSaasStatus(status)) return { ok: false, error: "Статус буруу" };

  const seatsRaw = get("seats");
  let seats: number | null = null;
  if (seatsRaw) {
    if (!/^\d+$/.test(seatsRaw) || Number(seatsRaw) < 1) return { ok: false, error: "Суудал 1-ээс доошгүй бүхэл тоо (хоосон = багцын default)" };
    seats = Number(seatsRaw);
  }
  const dateField = (key: string, label: string): { ok: true; value: string | null } | { ok: false; error: string } => {
    const raw = get(key);
    if (!raw) return { ok: true, value: null };
    if (!SAAS_DATE_RE.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()))
      return { ok: false, error: `${label}: огноо YYYY-MM-DD` };
    return { ok: true, value: raw };
  };
  const trial = dateField("trial_ends_at", "Trial дуусах");
  if (!trial.ok) return trial;
  const period = dateField("current_period_end", "Төлбөрийн үе дуусах");
  if (!period.ok) return period;
  if (status === "trialing" && !trial.value)
    return { ok: false, error: "Туршилт статуст trial дуусах огноо заавал" };

  let overrides: unknown = null;
  const overridesRaw = get("overrides");
  if (overridesRaw) {
    try {
      overrides = JSON.parse(overridesRaw);
    } catch {
      return { ok: false, error: "overrides JSON задлагдсангүй" };
    }
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
      return { ok: false, error: "overrides нь { \"features\": {…}, \"limits\": {…} } объект байна" };
    const keys = Object.keys(overrides as object);
    if (keys.some((key) => key !== "features" && key !== "limits"))
      return { ok: false, error: "overrides зөвхөн features / limits түлхүүртэй" };
    if (keys.length === 0) overrides = null;
  }
  const note = get("note") || null;
  return {
    ok: true,
    input: { organizationId, planId, status, seats, trialEndsAt: trial.value, currentPeriodEnd: period.value, overrides, note },
  };
}

export function formatOverrides(value: unknown): string {
  if (!value || typeof value !== "object" || Object.keys(value as object).length === 0) return "";
  return JSON.stringify(value, null, 2);
}
