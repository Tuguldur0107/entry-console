import Link from "next/link";

import { SyncAllButton } from "@/components/forms";
import { Icons } from "@/components/icons";
import { EVENT_LABELS, EmptyState, HealthBadge, Kpi, PageHeader, RunBadge, Section, StatusBadge, fmtAgo, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { computeAttention, loadDashboard, loadRecentActivity } from "@/lib/customers";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  await requireSession();
  const [{ latest, customers, provisioning, githubErrors }, activity] = await Promise.all([loadDashboard(), loadRecentActivity(10)]);
  const visible = customers.filter((c) => c.customer.status !== "archived");
  const active = visible.filter((c) => c.customer.status === "active");
  const behindCount = visible.filter((c) => c.behind).length;
  const downCount = visible.filter((c) => c.health && !c.health.ok).length;
  const mrr = active.reduce((s, c) => s + Number(c.customer.monthlyFee), 0);
  const attention = computeAttention(visible, latest, githubErrors.length === 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Самбар"
        sub={<>Core {latest ? <a href={latest.htmlUrl} target="_blank" rel="noreferrer" className="mono text-text-1 hover:underline">{latest.tagName}</a> : "release алга"} · {config.coreRepo}</>}
      >
        <SyncAllButton latestTag={latest?.tagName ?? null} count={active.filter((c) => c.behind !== false || !c.health).length} />
        <Link href="/customers/new" className="btn btn-primary"><Icons.plus className="h-4 w-4" /> Харилцагч нэмэх</Link>
      </PageHeader>

      {githubErrors.length > 0 && (
        <div className="notice notice-danger">
          <strong>GitHub холболтын алдаа</strong> — <Link href="/settings" className="underline">Тохиргоо, шалгалт</Link> хуудсанд дэлгэрэнгүй.
          <ul className="mt-1 list-disc pl-5">{githubErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Идэвхтэй харилцагч" value={String(active.length)} sub={`нийт ${visible.length}${provisioning.length ? ` · үүсгэж байна ${provisioning.length}` : ""}`} href="/customers" />
        <Kpi label="Сарын орлого (MRR)" value={fmtMnt(mrr)} sub="идэвхтэй харилцагчдын сарын төлбөр" />
        <Kpi label="Хоцорсон хувилбар" value={String(behindCount)} tone={behindCount > 0 ? "warning" : "success"} sub={latest ? `core ${latest.tagName}` : undefined} />
        <Kpi label="Хүрэхгүй deploy" value={String(downCount)} tone={downCount > 0 ? "danger" : "success"} sub="/api/health хариу" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
              <div className="-mx-5 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Харилцагч</th><th>Төлөв</th><th>Deploy</th><th>Sync</th><th>Төлбөр</th></tr></thead>
                  <tbody>
                    {visible.slice(0, 8).map(({ customer: c, repo, health, behind, lastSync }) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/customers/${c.slug}`} className="font-medium hover:underline">{c.displayName}</Link>
                          <div className="mono text-text-3">{repo?.fullName ?? c.githubRepo}</div>
                        </td>
                        <td><StatusBadge status={c.status} /></td>
                        <td><HealthBadge health={health} behind={behind} latest={latest?.tagName ?? null} /></td>
                        <td><RunBadge run={lastSync} /></td>
                        <td className="text-text-2">{Number(c.monthlyFee) > 0 ? `${fmtMnt(c.monthlyFee)}/сар` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
