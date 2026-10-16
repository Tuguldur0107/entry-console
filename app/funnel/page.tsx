import Link from "next/link";

import { FunnelChart } from "@/components/funnel-chart";
import { FunnelOrgsGrid } from "@/components/grids/funnel-orgs-grid";
import { EmptyState, FilterChips, Kpi, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getTrialFunnel, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  biggestDropOff,
  fmtHours,
  fmtRate,
  FUNNEL_PRODUCTS,
  parseDays,
  RANGE_OPTIONS,
  rangeForDays,
  type FunnelProduct,
  type TrialFunnel,
} from "@/lib/saas-insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Туршилтын funnel" };

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string; product?: string }> }) {
  await requireSession();
  const params = await searchParams;
  const days = parseDays(params.days, 90);
  const product: FunnelProduct = params.product === "skills" ? "skills" : "accounting";
  const range = rangeForDays(days);

  let funnel: TrialFunnel | null = null;
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      funnel = await getTrialFunnel({ ...range, product });
    } catch (caught) {
      error = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    }
  }
  const href = (next: { days?: number; product?: string }) =>
    `/funnel?${new URLSearchParams({ days: String(next.days ?? days), product: next.product ?? product }).toString()}`;

  const stages = funnel?.stages ?? [];
  const paid = stages.find((stage) => stage.key === "paid");
  const manual = funnel ? funnel.orgs.filter((org) => org.manuallyConverted && org.lastStage !== "paid").length : 0;
  const connected = stages.find((stage) => stage.key === "connected");
  const drop = biggestDropOff(stages);
  const excluded = funnel ? funnel.excluded.demo + funnel.excluded.additionalCompany + funnel.excluded.otherProduct : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Туршилтын funnel" sub={funnel ? `${funnel.from} – ${funnel.to} хооронд бүртгүүлсэн байгууллагууд` : undefined}>
        <Link href="/subscriptions" className="btn btn-sm">SaaS байгууллагууд</Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips active={product} items={FUNNEL_PRODUCTS.map((p) => ({ value: p.value, label: p.label, href: href({ product: p.value }) }))} />
        <FilterChips active={String(days)} items={RANGE_OPTIONS.map((d) => ({ value: String(d), label: `${d} хоног`, href: href({ days: d }) }))} />
      </div>

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}

      {funnel ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Бүртгүүлсэн" value={funnel.cohortSize.toLocaleString("en-US")} sub={excluded ? `${excluded} хасагдсан (демо, нэмэлт компани)` : "шинэ байгууллага"} />
            <Kpi label="AI холбосон" value={fmtRate(connected?.rateFromSignup)} sub={`${connected?.count ?? 0} байгууллага · медиан ${fmtHours(connected?.medianHoursFromSignup)}`} />
            <Kpi label="Төлсөн" value={fmtRate(paid?.rateFromSignup)} tone={paid && paid.count > 0 ? "success" : undefined} sub={`${paid?.count ?? 0} байгууллага · медиан ${fmtHours(paid?.medianHoursFromSignup)}${manual ? ` · +${manual} гараар` : ""}`} />
            <Kpi
              label="Хамгийн их алдагдал"
              value={drop ? fmtRate(1 - (drop.to.rateFromPrevious ?? 0)) : "—"}
              tone={drop ? "warning" : undefined}
              sub={drop ? `${drop.from.label} → ${drop.to.label}` : "алдагдал алга"}
            />
          </div>

          <Section title="Алхмууд" sub="Дараалсан: алхамд хүрсэн = өмнөх бүх алхмыг давсан">
            {funnel.cohortSize === 0 ? <EmptyState title="Энэ хугацаанд бүртгүүлсэн байгууллага алга" /> : <FunnelChart stages={stages} />}
          </Section>

          <Section title="Байгууллагууд" sub={`${funnel.orgs.length} · мөр дээр дарж дэлгэрэнгүй`}>
            {funnel.orgs.length === 0 ? (
              <EmptyState title="Байгууллага алга" />
            ) : (
              <FunnelOrgsGrid rows={funnel.orgs} stages={stages.map((stage) => stage.key)} />
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
