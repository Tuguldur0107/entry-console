import Link from "next/link";

import { AutoSyncAllButton, QuickApproveButton, SyncAllButton } from "@/components/forms";
import { CustomersGrid } from "@/components/grids/customers-grid";
import { Icons } from "@/components/icons";
import { EVENT_LABELS, EmptyState, Kpi, PageHeader, RunBadge, Section, fmtAgo, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { toCustomerGridRow } from "@/lib/customer-grid";
import { autoSyncStats, computeAttention, loadDashboard, loadRecentActivity } from "@/lib/customers";
import { isRequestStatus } from "@/lib/db/schema";
import { listSaasSubscriptions, saasApiConfigured } from "@/lib/saas-api";
import { computeSaasAttention } from "@/lib/saas-attention";
import { summarizeRevenue, summarizeSaasRows, type SaasSubscriptionRow } from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  await requireSession();
  const [{ latest, customers, provisioning, githubErrors }, activity, saas] = await Promise.all([
    loadDashboard(),
    loadRecentActivity(10),
    loadSaasOverview(),
  ]);
  const requests = customers.filter((c) => c.customer.status === "pending");
  const visible = customers.filter((c) => c.customer.status !== "archived" && !isRequestStatus(c.customer.status));
  const active = visible.filter((c) => c.customer.status === "active");
  const behindCount = visible.filter((c) => c.behind).length;
  const downCount = visible.filter((c) => c.health && !c.health.ok).length;
  const mrr = active.reduce((s, c) => s + Number(c.customer.monthlyFee), 0);
  const attention = computeAttention(visible, latest, githubErrors.length === 0);
  const sync = autoSyncStats(visible.map((c) => c.customer));
  const saasSummary = summarizeSaasRows(saas.rows);
  const saasRevenue = summarizeRevenue(saas.rows);
  const saasAttention = computeSaasAttention(saas.rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Самбар"
        sub={<>Core {latest ? <a href={latest.htmlUrl} target="_blank" rel="noreferrer" className="mono text-text-1 hover:underline">{latest.tagName}</a> : "release алга"} · {config.coreRepo}</>}
      >
        <AutoSyncAllButton off={sync.off.length} />
        <SyncAllButton latestTag={latest?.tagName ?? null} count={active.filter((c) => c.behind !== false || !c.health).length} />
        <Link href="/customers/new" className="btn btn-primary"><Icons.plus className="h-4 w-4" /> Харилцагч нэмэх</Link>
      </PageHeader>

      {githubErrors.length > 0 && (
        <div className="notice notice-danger">
          <strong>GitHub холболтын алдаа</strong> — <Link href="/settings" className="underline">Тохиргоо, шалгалт</Link> хуудсанд дэлгэрэнгүй.
          <ul className="mt-1 list-disc pl-5">{githubErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {requests.length > 0 && (
        <Section title="Бүртгүүлэх хүсэлт" sub={`${requests.length} хүлээгдэж байна · батлахад repo + Railway автоматаар үүснэ`} right={<Link href="/customers?status=pending" className="btn btn-ghost btn-sm">Бүгд</Link>}>
          <ul className="divide-y divide-border">
            {requests.slice(0, 5).map(({ customer: c }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/customers/${c.slug}`} className="font-medium hover:underline">{c.displayName}</Link>
                  <span className="mono ml-2 text-text-3">entry-{c.slug}</span>
                  <div className="text-text-2">{[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join(" · ")} <span className="text-xs text-text-3">· {fmtAgo(c.createdAt)}</span></div>
                  {c.requestNote && <div className="mt-0.5 truncate text-xs text-text-3" title={c.requestNote}>«{c.requestNote}»</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/customers/${c.slug}`} className="btn btn-sm">Дэлгэрэнгүй</Link>
                  <QuickApproveButton slug={c.slug} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Идэвхтэй харилцагч" value={String(active.length)} sub={`нийт ${visible.length}${provisioning.length ? ` · үүсгэж байна ${provisioning.length}` : ""}${requests.length ? ` · хүсэлт ${requests.length}` : ""}`} href="/customers" />
        <Kpi label="Сарын орлого (MRR)" value={fmtMnt(mrr + saasRevenue.mrrMnt)} sub={`тусдаа сервис ${fmtMnt(mrr)} · SaaS ${fmtMnt(saasRevenue.mrrMnt)}${saasRevenue.unknown ? ` · ${saasRevenue.unknown} дүн тодорхойгүй` : ""}`} tone={saasRevenue.unknown ? "warning" : undefined} href="/subscriptions/pricing" />
        <Kpi label="Хоцорсон хувилбар" value={String(behindCount)} tone={behindCount > 0 ? "warning" : "success"} sub={`${latest ? `core ${latest.tagName} · ` : ""}авто sync ${sync.on}/${sync.eligible}`} />
        <Kpi label="Хүрэхгүй deploy" value={String(downCount)} tone={downCount > 0 ? "danger" : "success"} sub="/api/health хариу" />
      </div>

      <Section
        title="SaaS байгууллагууд"
        sub={saas.error ? "SaaS API холбогдоогүй" : `${saasSummary.total} байгууллага · ${saasSummary.active} идэвхтэй · ${saasSummary.trialing} туршилт · ${saasRevenue.billable} төлбөртэй`}
        right={<Link href="/subscriptions" className="btn btn-ghost btn-sm">Жагсаалт</Link>}
      >
        {saas.error ? (
          <p className="notice notice-warning">{saas.error} — <Link href="/settings" className="underline">Тохиргоо, шалгалт</Link></p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="Байгууллага" value={String(saasSummary.total)} sub={`${saasSummary.active} идэвхтэй · ${saasSummary.trialing} туршилт`} href="/subscriptions" />
              <Kpi label="Төлбөр хоцорсон" value={String(saasSummary.pastDue)} sub={`${saasSummary.suspended} түр зогсоосон`} tone={saasSummary.pastDue ? "warning" : undefined} href="/subscriptions?status=past_due" />
              <Kpi label="Зөвхөн унших" value={String(saasSummary.readOnly)} sub="бичих эрх хаагдсан" tone={saasSummary.readOnly ? "danger" : undefined} href="/subscriptions?status=readonly" />
              <Kpi label="7 хоногт дуусах" value={String(saasSummary.endingSoon)} sub={saasSummary.overSeats ? `${saasSummary.overSeats} суудал хэтэрсэн` : "trial / grace"} tone={saasSummary.endingSoon || saasSummary.overSeats ? "warning" : undefined} href="/subscriptions?status=trialing" />
              <Kpi label="SaaS MRR" value={fmtMnt(saasRevenue.mrrMnt)} sub={`${saasRevenue.billable} төлбөртэй${saasRevenue.unknown ? ` · ${saasRevenue.unknown} дүн тодорхойгүй` : ""}`} tone={saasRevenue.unknown ? "warning" : undefined} href="/subscriptions/pricing" />
            </div>
            {saasAttention.length === 0 ? (
              <p className="text-sm text-text-3">Анхаарах байгууллага алга — бичих эрх нээлттэй, төлбөр хугацаандаа.</p>
            ) : (
              <ul className="space-y-2">
                {saasAttention.slice(0, 8).map((a, i) => (
                  <li key={`${a.organizationId}-${i}`} className={`notice notice-${a.tone}`}>
                    <Link href={`/subscriptions/${a.organizationId}`} className="font-medium hover:underline">{a.title}</Link> — {a.detail}
                  </li>
                ))}
                {saasAttention.length > 8 ? (
                  <li className="text-xs text-text-3">… дахин {saasAttention.length - 8} — <Link href="/subscriptions?status=past_due" className="underline">жагсаалтаас</Link></li>
                ) : null}
              </ul>
            )}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Анхаарах зүйлс" sub={attention.length === 0 ? "Бүх зүйл хэвийн" : `${attention.length} асуудал`}>
            {attention.length === 0 ? (
              <p className="text-sm text-text-3">Асуудал алга — deploy бүгд хүрч, хувилбарууд шинэ байна.</p>
            ) : (
              <ul className="space-y-2">
                {attention.map((a, i) => (
                  <li key={i} className={`notice notice-${a.tone === "info" ? "info" : a.tone}`}>
                    <Link href={`/customers/${a.slug}`} className="font-medium hover:underline">{a.title}</Link> — {a.detail}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Харилцагчид" sub="сүүлд нэмэгдсэн эхэндээ" right={<Link href="/customers" className="btn btn-ghost btn-sm">Бүгдийг харах</Link>}>
            {visible.length === 0 ? (
              <EmptyState title="Харилцагч алга" sub="Эхний харилцагчаа нэмэхэд repo автоматаар үүснэ." action={<Link href="/customers/new" className="btn btn-primary">Харилцагч нэмэх</Link>} />
            ) : (
              <CustomersGrid compact rows={visible.slice(0, 8).map((row) => toCustomerGridRow(row, latest?.tagName ?? null))} />
            )}
          </Section>
        </div>

        <div className="space-y-4">
          {provisioning.length > 0 && (
            <Section title="Repo үүсгэж байна" sub="core дээрх provision workflow">
              <ul className="space-y-2 text-sm">
                {provisioning.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{run.displayTitle.replace("Provision: ", "entry-")}</span>
                    <RunBadge run={run} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Сүүлийн үйл явдал" sub="бүх харилцагч">
            {activity.length === 0 ? (
              <p className="text-sm text-text-3">Хараахан юу ч болоогүй.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <Icons.activity className="mt-0.5 h-4 w-4 shrink-0 text-text-3" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Link href={`/customers/${e.slug}`} className="font-medium hover:underline">{e.displayName}</Link>
                        <span className="badge badge-muted badge-plain">{EVENT_LABELS[e.type] ?? e.type}</span>
                        <span className="text-xs text-text-3">{fmtAgo(e.createdAt)}</span>
                      </div>
                      <p className="text-text-2">{e.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** SaaS API тохируулаагүй / хүрэхгүй бол самбар унахгүй — хэсэг нь анхааруулгатай. */
async function loadSaasOverview(): Promise<{ rows: SaasSubscriptionRow[]; error: string | null }> {
  if (!saasApiConfigured()) return { rows: [], error: "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй" };
  try {
    return { rows: await listSaasSubscriptions(), error: null };
  } catch (caught) {
    return { rows: [], error: caught instanceof Error ? caught.message : String(caught) };
  }
}
