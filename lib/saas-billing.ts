// Багцын QPay төлбөр — ЦЭВЭР давхарга (fetch, DB, session БАЙХГҮЙ; тесттэй).
// Core-ийн GET /api/platform/billing-payments хариуны хэлбэр
// (core: lib/billing/platform-payments.ts) ба харуулах дүрмүүд.
// Төлөвийн жагсаалт core-ийн lib/billing/self-pay.ts BILLING_PAYMENT_STATUSES-тэй ИЖИЛ.

export type SaasBillingPaymentStatus = "open" | "paid" | "cancelled" | "expired" | "failed";

export type SaasBillingPayment = {
  id: string;
  organizationId: string;
  orgName: string;
  payerEmail: string | null;
  planId: string;
  seats: number;
  months: number;
  pricePerSeatMnt: number;
  amount: number;
  status: SaasBillingPaymentStatus;
  qpayInvoiceId: string | null;
  paymentId: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lastError: string | null;
  createdAt: string;
};

export const BILLING_PAYMENT_STATUSES: SaasBillingPaymentStatus[] = ["paid", "open", "failed", "expired", "cancelled"];

export const BILLING_PAYMENT_STATUS_LABELS: Record<SaasBillingPaymentStatus, string> = {
  open: "Хүлээж байна",
  paid: "Төлөгдсөн",
  cancelled: "Цуцалсан",
  expired: "Хугацаа дууссан",
  failed: "Алдаатай",
};

export const BILLING_PAYMENT_STATUS_BADGE: Record<SaasBillingPaymentStatus, string> = {
  open: "badge-warning",
  paid: "badge-success",
  cancelled: "badge-muted",
  expired: "badge-muted",
  failed: "badge-danger",
};

const UB_OFFSET_MS = 8 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Улаанбаатарын сар (YYYY-MM) — орлогыг сараар тоолоход (UTC-ээр БИШ). */
export function ubMonth(iso: string | Date): string {
  const time = (typeof iso === "string" ? new Date(iso) : iso).getTime();
  return new Date(time + UB_OFFSET_MS).toISOString().slice(0, 7);
}

/** Төлөгдсөн дүн — core бичсэн paidAmount, байхгүй бол нэхэмжлэхийн дүн. */
export function paidAmountOf(row: SaasBillingPayment): number {
  return row.paidAmount ?? row.amount;
}

export type BillingPaymentSummary = {
  /** Энэ (УБ) сард төлөгдсөн дүн */
  thisMonthMnt: number;
  thisMonthCount: number;
  /** Сүүлийн 30 хоногт төлөгдсөн */
  last30dMnt: number;
  last30dCount: number;
  /** Дүн зөрсөн — Console-оос гараар шийднэ */
  failed: number;
  /** Одоо QR нь нээлттэй */
  open: number;
  /** Төлбөр хийсэн давхардалгүй байгууллага (жагсаалт дотор) */
  payingOrgs: number;
};

export function summarizeBillingPayments(rows: SaasBillingPayment[], now = new Date()): BillingPaymentSummary {
  const month = ubMonth(now);
  const since = now.getTime() - 30 * DAY_MS;
  const summary: BillingPaymentSummary = {
    thisMonthMnt: 0,
    thisMonthCount: 0,
    last30dMnt: 0,
    last30dCount: 0,
    failed: 0,
    open: 0,
    payingOrgs: 0,
  };
  const orgs = new Set<string>();
  for (const row of rows) {
    if (row.status === "failed") summary.failed++;
    if (row.status === "open") summary.open++;
    if (row.status !== "paid") continue;
    orgs.add(row.organizationId);
    const at = row.paidAt ?? row.createdAt;
    const amount = paidAmountOf(row);
    if (ubMonth(at) === month) {
      summary.thisMonthMnt += amount;
      summary.thisMonthCount++;
    }
    if (new Date(at).getTime() >= since) {
      summary.last30dMnt += amount;
      summary.last30dCount++;
    }
  }
  summary.payingOrgs = orgs.size;
  return summary;
}

export function filterBillingPayments(
  rows: SaasBillingPayment[],
  filter: { status?: string; q?: string }
): SaasBillingPayment[] {
  const status = (filter.status ?? "").trim();
  const q = (filter.q ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!q) return true;
    return [row.orgName, row.payerEmail ?? "", row.qpayInvoiceId ?? "", row.organizationId, row.id]
      .some((field) => field.toLowerCase().includes(q));
  });
}

/** «3 сар · 1 суудал» — хүснэгт, картын товч тайлбар. */
export function describePaymentTerm(row: Pick<SaasBillingPayment, "months" | "seats">): string {
  return `${row.months} сар · ${row.seats} суудал`;
}
