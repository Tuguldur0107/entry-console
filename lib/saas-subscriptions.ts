// SaaS багцын ЦЭВЭР давхарга — fetch, DB, session БАЙХГҮЙ (тесттэй).
// Багц/статусын жагсаалт core-ийн lib/billing/plans.ts-тэй ИЖИЛ байх ёстой —
// core талд шинэ багц нэмэгдвэл энд ч нэмнэ (API validation core-д хийгдэнэ,
// энд зөвхөн харуулах шошго + формын урьдчилсан шалгалт).

export type SaasPlanId = "trial" | "standard" | "platform" | "enterprise" | "dedicated" | "skills";
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
  /** Бодит суудлын үнэ: тусгай үнэ → багцын үнэ (null = хэлэлцээрээр). */
  pricePerSeatMnt: number | null;
  /** ЗӨВХӨН энэ байгууллагад тогтоосон тусгай үнэ (null = багцын үнэ дагана). */
  pricePerSeatOverrideMnt: number | null;
  /** Төлсөн суудал × үнэ; аль нэг нь тодорхойгүй бол null. */
  monthlyAmountMnt: number | null;
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
  pricePerSeatMnt: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  overrides: unknown;
  note: string | null;
};

/** core: GET /api/platform/plan-prices — тухайн өдөр үйлчлэх ₮/суудал/сар (null = хэлэлцээрээр). */
export type SaasPlanPrices = Partial<Record<SaasPlanId, number | null>>;

/** Үнийн нэг ҮЕ. `effectiveTo` нь ХАМРУУЛСАН; null = хугацаагүй. */
export type SaasPlanPricePeriod = {
  id: string;
  planId: SaasPlanId;
  pricePerSeatMnt: number | null;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

/** Шинэ үе нэмэх оролт (core: POST /api/platform/plan-prices). */
export type SaasPlanPriceInput = {
  planId: SaasPlanId;
  pricePerSeatMnt: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

export const SAAS_PLAN_LABELS: Record<SaasPlanId, string> = {
  trial: "Туршилт",
  standard: "Standard",
  platform: "Platform",
  enterprise: "Enterprise",
  dedicated: "Тусдаа сервис",
  skills: "AI нягтлан (мэдлэгийн сан л)",
};

/** Console-оос ОНООЖ болох багцууд — `dedicated` нь лицензээр (тусдаа deploy), SaaS-д биш. */
export const SAAS_ASSIGNABLE_PLANS: SaasPlanId[] = ["trial", "standard", "platform", "enterprise", "skills"];

/**
 * БЭЛЭН ТОХИРГОО (preset) — түгээмэл харилцагчийн загварыг нэг товчоор.
 *
 * Гол хэрэглээ: «хувь хүн — олон байгууллагын НББ хөтөлдөг нягтлан».
 * Багц нь байгууллага бүрд мөртэй атлаа компанийн хязгаар нь ЭЗЭН хүнээр
 * тоологддог тул (core `countOwnedCompanies`) энэ төрлийн харилцагчид
 * `platform` багц + `limits.companies` override хэрэгтэй.
 *
 * Апп талд шинэ компани үүсэхэд эх байгууллагынхаа багцыг ӨВЛӨДӨГ болсон
 * (core `inheritSubscriptionForNewOrg`) тул ЭНЭ НЭГ мөрийг тохируулахад
 * тухайн нягтлангийн бүх компани ажиллана — компани бүрд гараар мөр
 * үүсгэх шаардлагагүй.
 */
export type SubscriptionPreset = {
  key: string;
  label: string;
  hint: string;
  planId: SaasPlanId;
  status: SaasSubscriptionStatus;
  seats: number;
  companies: number | null;
  /** YYYY-MM-DD — хоосон бол хөндөхгүй. */
  currentPeriodEnd: string;
  note: string;
};

/** Туршилтын/гэрээний хугацааны түгээмэл эцэс — гараар солиж болно. */
export const PRESET_PERIOD_END = "2030-12-31";

export const SUBSCRIPTION_PRESETS: SubscriptionPreset[] = [
  {
    key: "accountant-10",
    label: "Нягтлан бодогч — 10 компани",
    hint: "Хувь хүн, олон байгууллагын НББ хөтөлдөг",
    planId: "platform",
    status: "active",
    seats: 1,
    companies: 10,
    currentPeriodEnd: PRESET_PERIOD_END,
    note: "Нягтлан бодогч (хувь хүн) — 10 компани",
  },
  {
    key: "accountant-25",
    label: "Нягтлан бодогч — 25 компани",
    hint: "НББ-ийн фирм / томоохон багц",
    planId: "platform",
    status: "active",
    seats: 3,
    companies: 25,
    currentPeriodEnd: PRESET_PERIOD_END,
    note: "НББ фирм — 25 компани",
  },
  {
    key: "single",
    label: "Нэг компани (Standard)",
    hint: "Ердийн нэг байгууллагын харилцагч",
    planId: "standard",
    status: "active",
    seats: 1,
    companies: null,
    currentPeriodEnd: PRESET_PERIOD_END,
    note: "",
  },
];

/** Preset → overrides JSON текст (хоосон бол хоосон мөр). */
export function presetOverridesJson(preset: SubscriptionPreset): string {
  if (preset.companies === null) return "";
  return JSON.stringify({ limits: { companies: preset.companies } }, null, 2);
}

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

/** Үнэ тохируулж болох багцууд — trial нь үргэлж 0₮ тул жагсаалтад ОРНО (хөнгөлөлттэй туршилт). */
export const SAAS_PRICEABLE_PLANS: SaasPlanId[] = ["trial", "standard", "platform", "enterprise", "dedicated", "skills"];

/** Үнийн талбар → ₮ бүхэл тоо; хоосон → null (хэлэлцээрээр). core-ийн дүрэмтэй ИЖИЛ. */
export const MAX_PLAN_PRICE_MNT = 100_000_000;

export function parsePriceField(
  raw: string,
  label: string
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = (raw ?? "").replace(/[\s,₮]/g, "");
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: `${label}: сөрөг биш бүхэл тоо (₮) байна` };
  const value = Number(text);
  if (value > MAX_PLAN_PRICE_MNT)
    return { ok: false, error: `${label}: хэт их — дээд тал нь ${MAX_PLAN_PRICE_MNT.toLocaleString("en-US")}₮` };
  return { ok: true, value };
}


export type SaasRevenue = {
  /** Төлбөр хүлээгдэж буй (идэвхтэй + хоцорсон) байгууллагын сарын нийлбэр. */
  mrrMnt: number;
  /** Нийлбэрт орсон байгууллагын тоо. */
  billable: number;
  /** Дүн нь ТОДОРХОЙГҮЙ (үнэ эсвэл суудал дутуу) — нийлбэрт ОРООГҮЙ. */
  unknown: number;
};

/** MRR — үнэ ЗОХИОХГҮЙ: суудал эсвэл үнэ дутуу бол нийлбэрт оруулахгүй, ИЛ тоолно. */
export function summarizeRevenue(rows: SaasSubscriptionRow[]): SaasRevenue {
  const revenue: SaasRevenue = { mrrMnt: 0, billable: 0, unknown: 0 };
  for (const row of rows) {
    if (row.status !== "active" && row.status !== "past_due") continue;
    if (row.monthlyAmountMnt === null) revenue.unknown++;
    else {
      revenue.mrrMnt += row.monthlyAmountMnt;
      revenue.billable++;
    }
  }
  return revenue;
}

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
  const price = parsePriceField(get("price_per_seat"), "Тусгай үнэ");
  if (!price.ok) return price;

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
    input: {
      organizationId, planId, status, seats,
      pricePerSeatMnt: price.value,
      trialEndsAt: trial.value, currentPeriodEnd: period.value, overrides, note,
    },
  };
}

export function formatOverrides(value: unknown): string {
  if (!value || typeof value !== "object" || Object.keys(value as object).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Шинэ үнийн үеийн форм → API оролт; алдаа МОНГОЛООР. */
export function parsePlanPricePeriodForm(
  fields: Record<string, string>
): { ok: true; input: SaasPlanPriceInput } | { ok: false; error: string } {
  const get = (key: string) => (fields[key] ?? "").trim();
  const planId = get("plan_id");
  if (!isSaasPlanId(planId) || !SAAS_PRICEABLE_PLANS.includes(planId))
    return { ok: false, error: "Багц буруу байна" };
  const price = parsePriceField(get("price"), "Үнэ");
  if (!price.ok) return price;
  const from = get("effective_from");
  if (!isIsoDate(from)) return { ok: false, error: "Эхлэх огноо: YYYY-MM-DD" };
  const toRaw = get("effective_to");
  if (toRaw && !isIsoDate(toRaw)) return { ok: false, error: "Дуусах огноо: YYYY-MM-DD (хоосон = хугацаагүй)" };
  if (toRaw && toRaw < from) return { ok: false, error: "Дуусах огноо эхлэх огнооноос өмнө байна" };
  return {
    ok: true,
    input: {
      planId,
      pricePerSeatMnt: price.value,
      effectiveFrom: from,
      effectiveTo: toRaw || null,
      note: get("note") || null,
    },
  };
}

/** Тухайн өдөр үйлчилж буй үе (байхгүй бол null → кодын default мөрдөнө). */
export function currentPeriod(
  periods: SaasPlanPricePeriod[],
  planId: SaasPlanId,
  today: string
): SaasPlanPricePeriod | null {
  const matches = periods.filter(
    (period) => period.planId === planId && period.effectiveFrom <= today && today <= (period.effectiveTo ?? "9999-12-31")
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[matches.length - 1];
}

/** Багц → үеүүд, огнооны дарааллаар (түүхийн хүснэгтэд). */
export function groupPeriodsByPlan(
  periods: SaasPlanPricePeriod[]
): { planId: SaasPlanId; periods: SaasPlanPricePeriod[] }[] {
  return SAAS_PRICEABLE_PLANS.map((planId) => ({
    planId,
    periods: periods
      .filter((period) => period.planId === planId)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
  })).filter((group) => group.periods.length > 0);
}

/** Үеийн төлөв — UI-ийн шошго. */
export function periodStatus(
  period: SaasPlanPricePeriod,
  today: string
): { label: string; cls: string } {
  if (period.effectiveFrom > today) return { label: "Ирээдүйд", cls: "badge-info" };
  if (period.effectiveTo !== null && period.effectiveTo < today) return { label: "Дууссан", cls: "badge-muted" };
  return { label: "Мөрдөж буй", cls: "badge-success" };
}

/**
 * Нэрээр эрэмбэлэх — `localeCompare` ЭСЭРГҮҮЦНЭ: Node ба браузерын ICU өөр
 * дараалал өгч болзошгүй тул сервер/клиентийн HTML зөрж hydration унадаг
 * (React #418). Код цэгийн харьцуулалт хаана ч ИЖИЛ.
 */
export function byOrgName(a: { orgName: string }, b: { orgName: string }): number {
  if (a.orgName === b.orgName) return 0;
  return a.orgName < b.orgName ? -1 : 1;
}

/** Тусгай үнэ ТОГТООСОН байгууллагууд — үнийн хуудсанд. */
export function rowsWithSpecialPrice(rows: SaasSubscriptionRow[]): SaasSubscriptionRow[] {
  return rows.filter((row) => row.pricePerSeatOverrideMnt !== null).sort(byOrgName);
}

/**
 * Байгууллагын ТУСГАЙ ҮНИЙГ л сольсон бүтэн мөр.
 * core-ийн PUT нь мөрийг БҮТНЭЭР солидог тул бусад талбарыг хэвээр буцаана —
 * эс бөгөөс суудал, хугацаа, тэмдэглэл цэвэрлэгдэнэ.
 */
export function withSeatPrice(row: SaasSubscriptionRow, pricePerSeatMnt: number | null): SaasSubscriptionInput {
  return {
    organizationId: row.organizationId,
    planId: row.planId,
    status: row.status,
    seats: row.seats,
    pricePerSeatMnt,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
    overrides: row.overrides ?? null,
    note: row.note,
  };
}

// ── Багцын боломжийн override (Console-оос байгууллага бүрд асаах/унтраах) ──

/** overrides JSON текст → тухайн боломж ИЛ асаалттай эсэх (байхгүй = багцын дагуу). */
export function overrideFeatureState(overridesJson: string, key: string): boolean | null {
  if (!overridesJson.trim()) return null;
  try {
    const parsed = JSON.parse(overridesJson) as { features?: Record<string, unknown> };
    const value = parsed?.features?.[key];
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}

/**
 * overrides JSON текстэд боломжийг асаана/унтраана — бусад түлхүүр хэвээр.
 * `on === null` бол override-ыг хасна (багцын default руу буцна). Буруу JSON
 * бол ХӨНДӨХГҮЙ — хэрэглэгчийн бичсэн текстийг устгахгүй.
 */
export function setOverrideFeature(overridesJson: string, key: string, on: boolean | null): string {
  let parsed: { features?: Record<string, unknown>; limits?: unknown } = {};
  if (overridesJson.trim()) {
    try {
      const value = JSON.parse(overridesJson);
      if (!value || typeof value !== "object" || Array.isArray(value)) return overridesJson;
      parsed = value;
    } catch {
      return overridesJson;
    }
  }
  const features = { ...(parsed.features ?? {}) };
  if (on === null) delete features[key];
  else features[key] = on;
  const next: Record<string, unknown> = { ...parsed };
  if (Object.keys(features).length > 0) next.features = features;
  else delete next.features;
  return Object.keys(next).length === 0 ? "" : JSON.stringify(next, null, 2);
}
