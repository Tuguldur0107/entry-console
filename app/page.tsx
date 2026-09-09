import Link from "next/link";

import { PLAN_LABELS, STATUS_LABELS } from "@/components/forms";
import { HealthBadge, RunBadge, fmtDate } from "@/components/status";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { loadDashboard } from "@/lib/customers";

export const dynamic = "force-dynamic";

const fmtMnt = (v: string) => new Intl.NumberFormat("en-US").format(Number(v));

export default async function DashboardPage() {
  await requireSession();
  const { latest, customers, provisioning, githubErrors } = await loadDashboard();
  const active = customers.filter((c) => c.customer.status === "active");
  const behindCount = customers.filter((c) => c.behind).length;
  const downCount = customers.filter((c) => c.health && !c.health.ok).length;
  const mrr = active.reduce((s, c) => s + Number(c.customer.monthlyFee), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Харилцагчид</h1>
          <p className="text-sm text-text-3">
            Core:{" "}
            {latest ? (
              <a href={latest.htmlUrl} target="_blank" rel="noreferrer" className="font-medium text-text-1 underline-offset-2 hover:underline">
                {latest.tagName}
              </a>
            ) : (
              "release алга"
            )}{" "}
            · {config.coreRepo} · repo эзэн {config.owner}
          </p>
        </div>
        <Link href="/customers/new" className="btn btn-primary">+ Харилцагч нэмэх</Link>
      </div>

      {githubErrors.length > 0 && (
        <div className="card border-danger bg-danger-bg p-4 text-sm text-danger">
          <strong>GitHub холболтын алдаа</strong> — GITHUB_TOKEN-ийн эрх хүрэхгүй эсвэл буруу байна
          (classic PAT: repo, workflow, admin:org; эзэн {config.owner}).
          <ul className="mt-1 list-disc pl-5">
            {githubErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Идэвхтэй харилцагч" value={String(active.length)} sub={`нийт ${customers.length}`} />
        <Stat label="Сарын орлого (MRR)" value={`${fmtMnt(String(mrr))} ₮`} />
        <Stat label="Хоцорсон хувилбар" value={String(behindCount)} tone={behindCount > 0 ? "warning" : "success"} />
        <Stat label="Хүрэхгүй deploy" value={String(downCount)} tone={downCount > 0 ? "danger" : "success"} />
      </div>

      {provisioning.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">Repo үүсгэж байна</h2>
          <ul className="space-y-1 text-sm">
            {provisioning.map((run) => (
              <li key={run.id} className="flex items-center gap-3">
                <RunBadge run={run} />
                <span>{run.displayTitle}</span>
                <span className="text-text-3">{fmtDate(run.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-text-3">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">Харилцагч</th>
              <th className="px-4 py-2.5 font-medium">Төлөв</th>
              <th className="px-4 py-2.5 font-medium">Багц</th>
              <th className="px-4 py-2.5 font-medium">Deploy</th>
              <th className="px-4 py-2.5 font-medium">Сүүлийн sync</th>
              <th className="px-4 py-2.5 font-medium">Үүссэн</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-3">
                  Харилцагч алга. «Харилцагч нэмэх» товчоор эхний repo-гоо үүсгэнэ үү.
                </td>
              </tr>
            )}
            {customers.map(({ customer: c, repo, health, behind, lastSync }) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/customers/${c.slug}`} className="font-medium hover:underline">{c.displayName}</Link>
                  <div className="text-xs text-text-3">
                    {repo ? (
                      <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">{repo.fullName}</a>
                    ) : (
                      c.githubRepo
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`badge ${c.status === "active" ? "badge-success" : c.status === "provisioning" ? "badge-warning" : "badge-muted"}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-2">
                  {PLAN_LABELS[c.plan]}
                  {Number(c.monthlyFee) > 0 && <div className="text-xs text-text-3">{fmtMnt(c.monthlyFee)} ₮/сар</div>}
                </td>
                <td className="px-4 py-2.5">
                  <HealthBadge health={health} behind={behind} latest={latest?.tagName ?? null} />
                </td>
                <td className="px-4 py-2.5">
                  <RunBadge run={lastSync} />
                  {lastSync && <div className="text-xs text-text-3">{fmtDate(lastSync.createdAt)}</div>}
                </td>
                <td className="px-4 py-2.5 text-text-2">{fmtDate(c.createdAt.toISOString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-text-3">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-text-3">{sub}</div>}
    </div>
  );
}
