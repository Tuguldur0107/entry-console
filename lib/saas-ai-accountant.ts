// «AI нягтлан» (skills багц) захиалагчдын ЦЭВЭР давхарга — fetch, DB, session БАЙХГҮЙ (тесттэй).
// Оролт нь core-ийн GET /api/platform/subscriptions мөрүүд (SaasSubscriptionRow); энд зөвхөн
// skills багцынхыг ялгаж, Console-ийн «AI нягтлан» хуудасны KPI / шүүлтийг бодно.
//
// Бизнес модель (core: docs/knowledge/00-proposal.md D2′): Entry-ийн SaaS багц бүрд мэдлэгийн сан
// ҮНЭГҮЙ багтдаг; систем ашиглахгүй хүн ChatGPT / Claude-даа холбохын тулд «AI нягтлан» (skills,
// 29,000₮/сар, 24ц trial) захиална. Энэ хуудас ЗӨВХӨН тэр захиалагчдыг хянана — Entry-ийн
// байгууллагууд «SaaS байгууллагууд» хуудсандаа хэвээр.

import type { SaasSubscriptionRow } from "@/lib/saas-subscriptions";

export const AI_ACCOUNTANT_PLAN = "skills" as const;

export function isAiAccountantRow(row: SaasSubscriptionRow): boolean {
  return row.planId === AI_ACCOUNTANT_PLAN;
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
  filter: { status?: string; q?: string }
): SaasSubscriptionRow[] {
  const status = (filter.status ?? "").trim();
  const q = (filter.q ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (!isAiAccountantRow(row)) return false;
    if (status === "readonly" && row.writable) return false;
    else if (status === "unconnected" && isConnected(row)) return false;
    else if (status && status !== "readonly" && status !== "unconnected" && row.status !== status) return false;
    if (!q) return true;
    return [row.ownerEmail ?? "", row.orgName, row.organizationId].some((field) => field.toLowerCase().includes(q));
  });
}

export type AiAccountantSummary = {
  total: number;
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
  /** Сүүлийн 30 хоногт мэдлэгийн сангаас уншсан (жинхэнэ хэрэглэгч) */
  activeUsers30d: number;
  /** Сарын орлого — төлсөн (active + grace) захиалгын сарын дүнгийн нийлбэр; дүн тодорхойгүйг ОРУУЛАХГҮЙ */
  mrrMnt: number;
  mrrUnknown: number;
};

export function summarizeAiAccountant(rows: SaasSubscriptionRow[]): AiAccountantSummary {
  const summary: AiAccountantSummary = {
    total: 0,
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
    if (!isAiAccountantRow(row)) continue;
    summary.total++;
    if (row.status === "trialing") summary.trialing++;
    else if (row.status === "active") summary.paid++;
    else if (row.status === "past_due") summary.pastDue++;
    if (!row.writable) summary.readOnly++;
    if (row.writable && !isConnected(row)) summary.unconnected++;
    if ((row.knowledgeReads30d ?? 0) > 0) summary.activeUsers30d++;
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
