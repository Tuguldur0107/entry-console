// SaaS байгууллагуудын «Анхаарах зүйлс» — самбарт харуулах ЦЭВЭР дүрэм (тесттэй).
// Сүлжээ, DB БАЙХГҮЙ; оролт нь /api/platform/subscriptions-ийн мөрүүд.

import { describeSaasSeats, type SaasSubscriptionRow } from "./saas-subscriptions";

export type SaasAttentionItem = {
  tone: "danger" | "warning" | "info";
  organizationId: string;
  title: string;
  detail: string;
};

/** Ойрын хоног — trial / grace дуусахад анхааруулах босго. */
export const SAAS_SOON_DAYS = 7;

/**
 * Дараалал: бичих эрх хаагдсан (danger) → төлбөр хоцорсон (warning) →
 * суудал хэтэрсэн (warning) → ойрын хугацаа (warning/info). Нэг байгууллага
 * олон мөртэй байж болно (тус бүр өөр шалтгаан).
 */
export function computeSaasAttention(rows: SaasSubscriptionRow[], soonDays = SAAS_SOON_DAYS): SaasAttentionItem[] {
  const out: SaasAttentionItem[] = [];
  const sorted = [...rows].sort((a, b) => a.orgName.localeCompare(b.orgName));
  for (const row of sorted) {
    if (row.status === "cancelled") continue;
    const base = { organizationId: row.organizationId, title: row.orgName };
    if (!row.writable)
      out.push({ ...base, tone: "danger", detail: `Бичих эрх хаагдсан — ${row.readOnlyReason ?? "зөвхөн унших"}` });
    else if (row.status === "past_due")
      out.push({
        ...base,
        tone: "warning",
        detail: `Төлбөр хоцорсон${row.daysLeft !== null ? ` — grace ${row.daysLeft} хоног үлдсэн` : ""}`,
      });
    else if (row.daysLeft !== null && row.daysLeft <= soonDays)
      out.push({
        ...base,
        tone: row.daysLeft <= 1 ? "warning" : "info",
        detail:
          row.status === "trialing"
            ? `Trial ${row.daysLeft <= 0 ? "өнөөдөр" : `${row.daysLeft} хоногт`} дуусна — багц оноох эсэх`
            : `Төлбөрийн үе ${row.daysLeft <= 0 ? "өнөөдөр" : `${row.daysLeft} хоногт`} дуусна`,
      });
    const seats = describeSaasSeats(row);
    if (seats.over) out.push({ ...base, tone: "warning", detail: `Суудал хэтэрсэн — ${seats.text}` });
  }
  return out;
}
