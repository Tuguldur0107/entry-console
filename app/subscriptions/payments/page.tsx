import Link from "next/link";

import { BillingPaymentsGrid } from "@/components/grids/billing-payments-grid";
import { EmptyState, FilterChips, Kpi, PageHeader, SearchForm, Section, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listSaasBillingPayments, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  BILLING_PAYMENT_STATUS_LABELS,
  BILLING_PAYMENT_STATUSES,
  filterBillingPayments,
  summarizeBillingPayments,
  type SaasBillingPayment,
} from "@/lib/saas-billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "QPay төлбөрүүд" };

const FILTERS = [
  { value: "", label: "Бүгд" },
  ...BILLING_PAYMENT_STATUSES.map((status) => ({ value: status, label: BILLING_PAYMENT_STATUS_LABELS[status] })),
];

// Сүүлийн N төлбөр — KPI (энэ сар, 30 хоног) үүгээр бодогдоно.
const LIMIT = 1000;

export default async function BillingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireSession();
  const { status = "", q = "" } = await searchParams;

  let rows: SaasBillingPayment[] = [];
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      rows = await listSaasBillingPayments({ limit: LIMIT });
    } catch (caught) {
      error = caught instanceof SaasApiError ? caught.message : caught instanceof Error ? caught.message : String(caught);
    }
  }
  const summary = summarizeBillingPayments(rows);
  const visible = filterBillingPayments(rows, { status, q });
  const link = (params: Record<string, string>) =>
    `/subscriptions/payments?${new URLSearchParams({ ...params, ...(q ? { q } : {}) }).toString()}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="QPay төлбөрүүд"
        sub="Байгууллагууд багцаа app.entry.mn дээр QPay-ээр өөрөө төлсөн түүх. Төлөгдмөгц багц автоматаар идэвхжиж хугацаа сунгагдана — энд зөвхөн хянана."
      >
        <Link href="/subscriptions" className="btn btn-sm">← Байгууллагууд</Link>
      </PageHeader>

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Энэ сарын орлого" value={fmtMnt(summary.thisMonthMnt)} sub={`${summary.thisMonthCount} төлбөр`} tone={summary.thisMonthMnt ? "success" : undefined} href={link({ status: "paid" })} />
        <Kpi label="Сүүлийн 30 хоног" value={fmtMnt(summary.last30dMnt)} sub={`${summary.last30dCount} төлбөр · ${summary.payingOrgs} байгууллага`} />
        <Kpi label="Алдаатай" value={String(summary.failed)} sub="дүн зөрсөн — гараар шийднэ" tone={summary.failed ? "danger" : undefined} href={link({ status: "failed" })} />
        <Kpi label="Хүлээж байна" value={String(summary.open)} sub="QR нээлттэй" tone={summary.open ? "warning" : undefined} href={link({ status: "open" })} />
      </div>

      <Section title="Төлбөрүүд" sub={`${visible.length} / ${rows.length} · байгууллага, и-мэйл, нэхэмжлэхийн дугаараар хайна`}>
        <div className="mb-4 space-y-3">
          <SearchForm q={q} placeholder="Байгууллага, и-мэйл, нэхэмжлэх…" hidden={{ status }} className="max-w-md" />
          <FilterChips
            active={status}
            items={FILTERS.map((filter) => ({
              value: filter.value,
              label: filter.label,
              href: link(filter.value ? { status: filter.value } : {}),
              count: filter.value === "" ? rows.length : filterBillingPayments(rows, { status: filter.value }).length,
            }))}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "Төлбөр алга" : "Шүүлтүүрт таарах төлбөр алга"}
            sub={rows.length === 0 && !error ? "Байгууллага «QPay-ээр төлөх» дармагц энд гарна." : undefined}
          />
        ) : (
          <BillingPaymentsGrid rows={visible} />
        )}
      </Section>

      <Section title="Дүрэм" sub="core: docs/billing/00-proposal.md §6a">
        <ul className="list-disc space-y-1 pl-4 text-xs text-text-3">
          <li><b>Төлөгдсөн</b> — багц идэвхжиж, хугацаа одоогийн эцсээс (туршилт / идэвхтэй хугацаа) үргэлжилнэ.</li>
          <li><b>Алдаатай</b> — төлсөн дүн нэхэмжлэхтэй таараагүй; мөнгө орсон байж болзошгүй тул QPay-ээс шалгаад багцыг гараар засна.</li>
          <li><b>Хугацаа дууссан / Цуцалсан</b> — төлөгдөөгүй QR; хожим төлөгдвөл core автоматаар «Төлөгдсөн» болгоно.</li>
          <li>Мөнгө Entry-ийн QPay мерчант руу орно (core env <span className="mono">ENTRY_BILLING_QPAY_*</span>).</li>
        </ul>
      </Section>
    </div>
  );
}
