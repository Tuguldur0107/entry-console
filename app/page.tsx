import Link from "next/link";

import { HealthBadge, RunBadge, fmtDate } from "@/components/status";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { loadDashboard } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ provisioning?: string }>;
}) {
  await requireSession();
  const { provisioning: justStarted } = await searchParams;
  const { latest, customers, provisioning } = await loadDashboard();
  const behindCount = customers.filter((c) => c.behind).length;
  const downCount = customers.filter((c) => c.health && !c.health.ok).length;

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
            · {config.coreRepo}
          </p>
        </div>
        <Link href="/customers/new" className="btn btn-primary">+ Харилцагч нэмэх</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Нийт харилцагч" value={customers.length} />
        <Stat label="Хоцорсон хувилбар" value={behindCount} tone={behindCount > 0 ? "warning" : "success"} />
        <Stat label="Хүрэхгүй deploy" value={downCount} tone={downCount > 0 ? "danger" : "success"} />
      </div>

      {(provisioning.length > 0 || justStarted) && (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">Үүсгэж байна</h2>
          {justStarted && provisioning.length === 0 && (
            <p className="text-sm text-text-2">
              <span className="badge badge-warning">эхэлсэн</span> entry-{justStarted} — workflow эхлэхэд 10–20 сек;
              хуудсыг сэргээнэ үү.
            </p>
          )}
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
              <th className="px-4 py-2.5 font-medium">Repo</th>
              <th className="px-4 py-2.5 font-medium">Deploy</th>
              <th className="px-4 py-2.5 font-medium">Сүүлийн sync</th>
              <th className="px-4 py-2.5 font-medium">Үүссэн</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-3">
                  Харилцагч алга. «Харилцагч нэмэх» товчоор эхний repo-гоо үүсгэнэ үү.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.repo.slug} className="border-b border-border last:border-0 hover:bg-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/customers/${c.repo.slug}`} className="font-medium hover:underline">
                    {c.displayName}
                  </Link>
                  <div className="text-xs text-text-3">{c.repo.slug}</div>
                </td>
                <td className="px-4 py-2.5">
                  <a href={c.repo.htmlUrl} target="_blank" rel="noreferrer" className="text-text-2 hover:underline">
                    {c.repo.fullName}
                  </a>
                </td>
                <td className="px-4 py-2.5">
                  <HealthBadge health={c.health} behind={c.behind} latest={latest?.tagName ?? null} />
                  {c.appUrl && (
                    <div className="text-xs text-text-3">
                      <a href={c.appUrl} target="_blank" rel="noreferrer" className="hover:underline">{c.appUrl}</a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <RunBadge run={c.lastSync} />
                  {c.lastSync && <div className="text-xs text-text-3">{fmtDate(c.lastSync.createdAt)}</div>}
                </td>
                <td className="px-4 py-2.5 text-text-2">{fmtDate(c.repo.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-text-3">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
