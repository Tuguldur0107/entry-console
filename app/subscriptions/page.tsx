import Link from "next/link";

import { EmptyState, Kpi, PageHeader, Section, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listSaasSubscriptions, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  describeSaasDeadline,
  describeSaasSeats,
  filterSaasRows,
  SAAS_PLAN_LABELS,
  SAAS_STATUS_BADGE,
  SAAS_STATUS_LABELS,
  SAAS_STATUSES,
  summarizeRevenue,
  summarizeSaasRows,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "SaaS багцууд" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Бүгд" },
  ...SAAS_STATUSES.map((status) => ({ value: status, label: SAAS_STATUS_LABELS[status] })),
  { value: "readonly", label: "Зөвхөн унших" },
];

const SETUP_HINT =
  "Railway → entry-console → Variables: ENTRY_SAAS_API_URL = ${{entry-accounting.NEXT_PUBLIC_APP_URL}}, " +
  "ENTRY_SAAS_API_KEY = core-ийн ENTRY_PLATFORM_API_KEY-тэй ижил утга; core талд ENTRY_DEPLOYMENT_MODE=saas.";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireSession();
  const { status = "", q = "" } = await searchParams;

  let rows: SaasSubscriptionRow[] = [];
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      rows = await listSaasSubscriptions();
    } catch (caught) {
      error = caught instanceof SaasApiError ? caught.message : caught instanceof Error ? caught.message : String(caught);
    }
  }
  const summary = summarizeSaasRows(rows);
  const revenue = summarizeRevenue(rows);
  const visible = filterSaasRows(rows, { status, q });

  return (
    <div className="space-y-5">
      <PageHeader
        title="SaaS багцууд"
        sub="Үндсэн SaaS сервис дээрх байгууллага бүрийн багц, статус, суудал, хугацаа — өөрчлөлт нь тэр даруй апп-д үйлчилнэ (бичих эрх, боломж, суудлын лимит)."
      >
        <Link href="/subscriptions/pricing" className="btn btn-sm">Багцын үнэ</Link>
      </PageHeader>

      {error ? (
        <div className="space-y-2">
          <p className="notice notice-danger" role="alert">{error}</p>
          <p className="text-xs text-text-3">{SETUP_HINT}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Байгууллага" value={String(summary.total)} sub={`${summary.active} идэвхтэй · ${summary.trialing} туршилт`} />
        <Kpi label="Төлбөр хоцорсон" value={String(summary.pastDue)} sub={`${summary.suspended} түр зогсоосон`} tone={summary.pastDue ? "warning" : undefined} href="/subscriptions?status=past_due" />
        <Kpi label="Зөвхөн унших" value={String(summary.readOnly)} sub="бичих эрх хаагдсан" tone={summary.readOnly ? "danger" : undefined} href="/subscriptions?status=readonly" />
        <Kpi label="7 хоногт дуусах" value={String(summary.endingSoon)} sub={summary.overSeats ? `${summary.overSeats} суудал хэтэрсэн` : "trial / grace"} tone={summary.endingSoon || summary.overSeats ? "warning" : undefined} />
        <Kpi
          label="Сарын орлого (MRR)"
          value={fmtMnt(revenue.mrrMnt)}
          sub={`${revenue.billable} төлбөртэй${revenue.unknown ? ` · ${revenue.unknown} дүн тодорхойгүй` : ""}`}
          tone={revenue.unknown ? "warning" : undefined}
          href="/subscriptions/pricing"
        />
      </div>

      <Section
        title="Байгууллагууд"
        sub={`${visible.length} / ${rows.length} · статусаар шүүх, нэр / ТТД / эзний и-мэйлээр хайх`}
        right={
          <form className="flex items-center gap-2" method="get">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input name="q" className="input" placeholder="Хайх…" defaultValue={q} style={{ width: 200 }} />
            <button className="btn btn-sm" type="submit">Хайх</button>
          </form>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = filter.value === status;
            const href = `/subscriptions?${new URLSearchParams({ ...(filter.value ? { status: filter.value } : {}), ...(q ? { q } : {}) }).toString()}`;
            return (
              <Link key={filter.value || "all"} href={href} className={`btn btn-sm ${active ? "btn-primary" : ""}`} aria-current={active ? "page" : undefined}>
                {filter.label}
              </Link>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "Байгууллага алга" : "Шүүлтүүрт таарах байгууллага алга"}
            sub={rows.length === 0 && !error ? "SaaS сервис дээр бүртгүүлсэн байгууллага энд гарна." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Байгууллага</th>
                  <th>Эзэн</th>
                  <th>Багц</th>
                  <th>Статус</th>
                  <th>Суудал</th>
                  <th>Үнэ / сарын дүн</th>
                  <th>Хугацаа</th>
                  <th>Trial дуусах</th>
                  <th>Үе дуусах</th>
                  <th>Бүртгэсэн</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const deadline = describeSaasDeadline(row);
                  const seats = describeSaasSeats(row);
                  return (
                    <tr key={row.organizationId}>
                      <td>
                        <Link href={`/subscriptions/${row.organizationId}`} className="font-medium hover:underline">{row.orgName}</Link>
                        <div className="mono text-text-3">{row.registryNo ?? "ТТД —"}{row.hasRow ? "" : " · default"}</div>
                      </td>
                      <td className="text-text-2">
                        {row.ownerEmail ?? "—"}
                        <div className="text-xs text-text-3">{row.memberCount} гишүүн</div>
                      </td>
                      <td>{SAAS_PLAN_LABELS[row.planId] ?? row.planId}</td>
                      <td><span className={`badge ${SAAS_STATUS_BADGE[row.status] ?? "badge-muted"}`}>{SAAS_STATUS_LABELS[row.status] ?? row.status}</span></td>
                      <td className={seats.over ? "text-danger font-medium" : ""}>{seats.text}</td>
                      <td>
                        {row.pricePerSeatMnt === null ? (
                          <span className="text-text-3">хэлэлцээрээр</span>
                        ) : (
                          <>
                            {fmtMnt(row.pricePerSeatMnt)}
                            {row.pricePerSeatOverrideMnt !== null ? (
                              <span className="ml-1 text-xs text-warning">тусгай</span>
                            ) : null}
                          </>
                        )}
                        <div className="text-xs text-text-3">
                          {row.monthlyAmountMnt === null ? "сарын дүн —" : `${fmtMnt(row.monthlyAmountMnt)} / сар`}
                        </div>
                      </td>
                      <td className={deadline.tone === "danger" ? "text-danger" : deadline.tone === "warning" ? "text-warning" : "text-text-2"}>{deadline.text}</td>
                      <td className="mono text-text-2">{row.trialEndsAt ?? "—"}</td>
                      <td className="mono text-text-2">{row.currentPeriodEnd ?? "—"}</td>
                      <td className="mono text-text-3">{row.createdAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
