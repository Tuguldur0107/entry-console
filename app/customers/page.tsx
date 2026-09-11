import Link from "next/link";

import { QuickApproveButton } from "@/components/forms";
import { Icons } from "@/components/icons";
import { EmptyState, HealthBadge, PLAN_LABELS, PageHeader, RunBadge, STATUS_LABELS, StatusBadge, fmtDate, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { filterCustomers, loadDashboard } from "@/lib/customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Харилцагчид" };

const FILTERS: [string, string][] = [["all", "Бүгд"], ["pending", "Хүсэлт"], ["active", "Идэвхтэй"], ["provisioning", "Үүсгэж байна"], ["suspended", "Түр зогссон"], ["archived", "Архив"], ["rejected", "Татгалзсан"]];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; deleted?: string }> }) {
  await requireSession();
  const { q, status = "all", deleted } = await searchParams;
  const { latest, customers } = await loadDashboard();
  const signupUrl = `${config.self.publicUrl ?? ""}/signup`;
  const rows = filterCustomers(customers, q, status);
  const csv = ["slug,name,register_no,contact,email,phone,status,plan,monthly_fee,repo,app_url,created_at",
    ...customers.map(({ customer: c }) => [c.slug, c.displayName, c.registerNo, c.contactName, c.contactEmail, c.contactPhone, c.status, c.plan, c.monthlyFee, c.githubRepo, c.appUrl, c.createdAt.toISOString()].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");

  return (
    <div className="space-y-4">
      {deleted && <p className="notice notice-success">«{deleted}» устлаа — Railway service, GitHub repo (байсан бол), console бүртгэл.</p>}
      {status === "pending" && <p className="notice notice-info">Нээлттэй бүртгүүлэх хуудас: <span className="mono">{signupUrl}</span> — хүсэлт энд «Хүсэлт» төлөвтэй орж ирнэ; батлахад repo + Railway автоматаар үүснэ.</p>}
      <PageHeader title="Харилцагчид" sub={`${customers.length} бүртгэл`}>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + csv)}`} download="entry-customers.csv" className="btn btn-sm"><Icons.download className="h-4 w-4" /> CSV</a>
        <Link href="/customers/new" className="btn btn-primary"><Icons.plus className="h-4 w-4" /> Харилцагч нэмэх</Link>
      </PageHeader>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <div className="relative min-w-64 flex-1">
          <Icons.search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-3" />
          <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Нэр, код, ТТД, имэйл, repo…" />
        </div>
        <input type="hidden" name="status" value={status} />
        <button className="btn" type="submit">Хайх</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, label]) => {
          const n = k === "all" ? customers.length : customers.filter((c) => c.customer.status === k).length;
          return (
            <Link key={k} href={`/customers?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`badge badge-plain ${status === k ? "badge-info" : "badge-muted"}`}>
              {label} <span className="opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="Илэрц алга" sub={q ? `«${q}» гэсэн хайлтад тохирох харилцагч байхгүй` : "Энэ төлөвт харилцагч алга"} />
        ) : (
          <table className="table">
            <thead><tr><th>Харилцагч</th><th>Төлөв</th><th>Багц</th><th>Deploy</th><th>Sync</th><th>Холбоо барих</th><th>Үүссэн</th></tr></thead>
            <tbody>
              {rows.map(({ customer: c, repo, health, behind, lastSync }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.slug}`} className="font-medium hover:underline">{c.displayName}</Link>
                    <div className="mono text-text-3">{repo?.fullName ?? c.githubRepo}</div>
                  </td>
                  <td><StatusBadge status={c.status} />{c.status === "pending" && <div className="mt-1"><QuickApproveButton slug={c.slug} /></div>}</td>
                  <td className="text-text-2">{PLAN_LABELS[c.plan]}{Number(c.monthlyFee) > 0 && <div className="text-xs text-text-3">{fmtMnt(c.monthlyFee)}/сар</div>}</td>
                  <td><HealthBadge health={health} behind={behind} latest={latest?.tagName ?? null} /></td>
                  <td><RunBadge run={lastSync} /></td>
                  <td className="text-text-2">{c.contactName ?? "—"}{c.contactPhone && <div className="text-xs text-text-3">{c.contactPhone}</div>}</td>
                  <td className="text-text-3">{fmtDate(c.createdAt, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-text-3">Төлөв: {Object.values(STATUS_LABELS).join(" · ")}</p>
    </div>
  );
}
