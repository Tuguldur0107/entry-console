// «AI нягтлан» ашиглагчдын ЦЭВЭР давхарга — fetch, DB, session БАЙХГҮЙ (тесттэй).
// Оролт нь core-ийн GET /api/platform/subscriptions мөрүүд (SaasSubscriptionRow); энд AI нягтлан
// ашиглагчдыг ялгаж, Console-ийн «AI нягтлан» хуудасны KPI / шүүлтийг бодно.
//
// Бизнес модель (core: docs/knowledge/00-proposal.md D2′): Entry-ийн SaaS багц бүрд мэдлэгийн сан
// ҮНЭГҮЙ багтдаг; систем ашиглахгүй хүн ChatGPT / Claude-даа холбохын тулд «AI нягтлан» (skills,
// 29,000₮/сар, 24ц trial) захиална. Хуудас ХОЁУЛАНГ харуулна (2026-09-30):
//   • paid — «AI нягтлан» (skills) захиалагч бүр
//   • free — Entry-ийн нягтлан бодох багцтай, мэдлэгийн сан нь багтсан бөгөөд ChatGPT / Claude-оо
//     холбосон ЭСВЭЛ сангаас уншсан байгууллага (ашиглаагүй Entry байгууллага бүрийг жагсаахгүй —
//     тэд «SaaS байгууллагууд»-д). Орлого, туршилт, grace-ийн KPI нь ЗӨВХӨН paid-ийнх.

import type { SaasSubscriptionRow } from "@/lib/saas-subscriptions";

export const AI_ACCOUNTANT_PLAN = "skills" as const;

/** paid = «AI нягтлан» захиалга; free = Entry-ийн багцад үнэгүй багтсан. */
export type AiAccountantKind = "paid" | "free";

export const AI_ACCOUNTANT_KIND_LABELS: Record<AiAccountantKind, string> = {
  paid: "Төлбөртэй",
  free: "Үнэгүй",
};

/** Төрлийн chip — «Бүгд» эхэнд. */
export const AI_ACCOUNTANT_KINDS: { value: "" | AiAccountantKind; label: string }[] = [
  { value: "", label: "Бүгд" },
  { value: "paid", label: "Төлбөртэй · AI нягтлан багц" },
  { value: "free", label: "Үнэгүй · Entry багцад багтсан" },
];

/**
 * Мэдлэгийн сан энэ байгууллагад багтсан уу — core `plans.ts`: SaaS багц бүрд ON, dedicated-д OFF;
 * Console-ийн override `{"features":{"knowledge":false|true}}` давамгайлна.
 */
export function knowledgeIncluded(row: SaasSubscriptionRow): boolean {
  const features = (row.overrides as { features?: Record<string, unknown> } | null | undefined)?.features;
  const override = features && typeof features === "object" ? features.knowledge : undefined;
  if (override === true) return true;
  if (override === false) return false;
  return row.planId !== "dedicated";
}

/** Ашиглаж эхэлсэн үү — ChatGPT / Claude холбосон эсвэл сангаас нэг ч удаа уншсан. */
function hasUsedAiAccountant(row: SaasSubscriptionRow): boolean {
  return (row.oauthConnections ?? 0) > 0 || (row.knowledgeReads30d ?? 0) > 0 || Boolean(row.lastKnowledgeReadAt);
}

/** Энэ хуудсанд харагдах эсэх, ямар төрлөөр — null = харагдахгүй. */
export function aiAccountantKind(row: SaasSubscriptionRow): AiAccountantKind | null {
  if (row.planId === AI_ACCOUNTANT_PLAN) return "paid";
  if (!knowledgeIncluded(row)) return null;
  return hasUsedAiAccountant(row) ? "free" : null;
}

export function isAiAccountantRow(row: SaasSubscriptionRow): boolean {
  return aiAccountantKind(row) !== null;
}

/** Шүүлтүүрийн chip — статусаас гадна холболтын байдал (хэрэглэгч холбож чадсан уу). */
export type AiAccountantFilterKey = "" | "trialing" | "active" | "past_due" | "readonly" | "unconnected";

export const AI_ACCOUNTANT_FILTERS: { value: AiAccountantFilterKey; label: string }[] = [
  { value: "", label: "Бүгд" },
  { value: "trialing", label: "Туршилт" },
  { value: "active", label: "Төлсөн" },
  { value: "past_due", label: "Хугацаа дууссан" },
  { value: "readonly", label: "Хаалттай" },
  { value: "unconnected", label: "Холбоогүй" },
];

/** Хэрэглэгч ChatGPT / Claude-оо холбосон уу — OAuth token нэг ч байхгүй бол «холбоогүй». */
export function isConnected(row: SaasSubscriptionRow): boolean {
  return (row.oauthConnections ?? 0) > 0;
}

export function filterAiAccountantRows(
  rows: SaasSubscriptionRow[],
  filter: { status?: string; q?: string; kind?: string }
): SaasSubscriptionRow[] {
  const status = (filter.status ?? "").trim();
  const q = (filter.q ?? "").trim().toLowerCase();
  const kind = (filter.kind ?? "").trim();
  return rows.filter((row) => {
    const rowKind = aiAccountantKind(row);
    if (!rowKind) return false;
    if (kind && rowKind !== kind) return false;
    if (status === "readonly" && row.writable) return false;
    else if (status === "unconnected" && isConnected(row)) return false;
    else if (status && status !== "readonly" && status !== "unconnected" && row.status !== status) return false;
    if (!q) return true;
    return [row.ownerEmail ?? "", row.orgName, row.organizationId].some((field) => field.toLowerCase().includes(q));
  });
}

export type AiAccountantSummary = {
  /** Бүх ашиглагч (paid + free). */
  total: number;
  /** «AI нягтлан» захиалагч. Доорх туршилт / төлсөн / grace / хаалттай / холбоогүй / орлого нь ЗӨВХӨН эднийх. */
  paidTotal: number;
  /** Entry-ийн багцад үнэгүй ашиглаж буй байгууллага. */
  freeTotal: number;
  /** Үнэгүйнхээс сүүлийн 30 хоногт уншсан. */
  freeActive30d: number;
  /** Үнэгүй туршилтад (24ц) */
  trialing: number;
  /** Төлсөн, хугацаа нь явж байгаа */
  paid: number;
  /** Төлсөн хугацаа дууссан — grace (3 хоног) дотор */
  pastDue: number;
  /** Бичих/унших эрх хаагдсан (trial эсвэл grace дууссан, зогсоосон) */
  readOnly: number;
  /** Идэвхтэй (trial + төлсөн + grace) ч ChatGPT / Claude-оо холбоогүй — онбордингийн саад */
  unconnected: number;
  /** Сүүлийн 30 хоногт мэдлэгийн сангаас уншсан (жинхэнэ хэрэглэгч) — paid + free */
  activeUsers30d: number;
  /** Сарын орлого — төлсөн (active + grace) захиалгын сарын дүнгийн нийлбэр; дүн тодорхойгүйг ОРУУЛАХГҮЙ */
  mrrMnt: number;
  mrrUnknown: number;
};

export function summarizeAiAccountant(rows: SaasSubscriptionRow[]): AiAccountantSummary {
  const summary: AiAccountantSummary = {
    total: 0,
    paidTotal: 0,
    freeTotal: 0,
    freeActive30d: 0,
    trialing: 0,
    paid: 0,
    pastDue: 0,
    readOnly: 0,
    unconnected: 0,
    activeUsers30d: 0,
    mrrMnt: 0,
    mrrUnknown: 0,
  };
  for (const row of rows) {
    const kind = aiAccountantKind(row);
    if (!kind) continue;
    summary.total++;
    const readRecently = (row.knowledgeReads30d ?? 0) > 0;
    if (readRecently) summary.activeUsers30d++;
    if (kind === "free") {
      summary.freeTotal++;
      if (readRecently) summary.freeActive30d++;
      continue;
    }
    summary.paidTotal++;
    if (row.status === "trialing") summary.trialing++;
    else if (row.status === "active") summary.paid++;
    else if (row.status === "past_due") summary.pastDue++;
    if (!row.writable) summary.readOnly++;
    if (row.writable && !isConnected(row)) summary.unconnected++;
    if (row.status === "active" || row.status === "past_due") {
      if (row.monthlyAmountMnt === null) summary.mrrUnknown++;
      else summary.mrrMnt += row.monthlyAmountMnt;
    }
  }
  return summary;
}

/** Холболтын багана: тоо эсвэл «холбоогүй» (идэвхгүй захиалагчид «—»). */
export function describeConnection(row: SaasSubscriptionRow): { text: string; tone: "" | "warning" } {
  const n = row.oauthConnections ?? 0;
  if (n > 0) return { text: `${n} холболт`, tone: "" };
  return row.writable ? { text: "холбоогүй", tone: "warning" } : { text: "—", tone: "" };
}
