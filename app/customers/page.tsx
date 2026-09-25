import Link from "next/link";

import { AutoSyncAllButton } from "@/components/forms";
import { CustomersGrid } from "@/components/grids/customers-grid";
import { Icons } from "@/components/icons";
import { EmptyState, FilterChips, PageHeader, SearchForm } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { toCustomerGridRow } from "@/lib/customer-grid";
import { autoSyncStats, filterCustomers, loadDashboard } from "@/lib/customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Харилцагчид" };

const FILTERS: [string, string][] = [["all", "Бүгд"], ["pending", "Хүсэлт"], ["active", "Идэвхтэй"], ["provisioning", "Үүсгэж байна"], ["suspended", "Түр зогссон"], ["archived", "Архив"], ["rejected", "Татгалзсан"]];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; deleted?: string }> }) {
  await requireSession();
  const { q, status = "all", deleted } = await searchParams;
  const { latest, customers } = await loadDashboard();
  const signupUrl = `${config.self.publicUrl ?? ""}/signup`;
  const rows = filterCustomers(customers, q, status);
  const sync = autoSyncStats(customers.map(({ customer: c }) => c));
  const pending = customers.filter(({ customer: c }) => c.status === "pending").length;
  const csv = ["slug,name,register_no,contact,email,phone,status,plan,monthly_fee,repo,app_url,created_at",
    ...customers.map(({ customer: c }) => [c.slug, c.displayName, c.registerNo, c.contactName, c.contactEmail, c.contactPhone, c.status, c.plan, c.monthlyFee, c.githubRepo, c.appUrl, c.createdAt.toISOString()].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");

  return (
    <div className="space-y-4">
      <PageHeader title="Харилцагчид" sub={`${customers.length} бүртгэл · авто sync ${sync.on}/${sync.eligible}`}>
        <AutoSyncAllButton off={sync.off.length} />
        <a title="Бүх харилцагч (шүүлтүүрээс үл хамааран)" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + csv)}`} download="entry-customers.csv" className="btn btn-sm"><Icons.download className="h-4 w-4" /> CSV</a>
        <Link href="/customers/new" className="btn btn-primary"><Icons.plus className="h-4 w-4" /> Харилцагч нэмэх</Link>
      </PageHeader>
      {deleted && <p className="notice notice-success">«{deleted}» устлаа — Railway service, GitHub repo (байсан бол), console бүртгэл.</p>}
      {status === "pending" && <p className="notice notice-info">Нээлттэй бүртгүүлэх хуудас: <span className="mono">{signupUrl}</span> — хүсэлт энд «Хүсэлт» төлөвтэй орж ирнэ; батлахад repo + Railway автоматаар үүснэ.</p>}
      {sync.off.length > 0 && (
        <p className="notice notice-warning">
          <strong>{sync.off.length} харилцагч гараар sync хийж байна</strong> — эдгээрт шинэ release гарах бүрд PR-ыг нь өөрөө merge хийх шаардлагатай.
          Авто sync асаавал шалгалт (tsc/lint/тест) давсан PR автоматаар merge хийгдэнэ; conflict гарвал хэвээрээ хүлээнэ.
        </p>
      )}

      <SearchForm q={q} placeholder="Нэр, код, ТТД, имэйл, repo…" hidden={{ status }} />
      <FilterChips
        active={status}
        items={FILTERS.map(([k, label]) => ({
          value: k,
          label,
          href: `/customers?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          count: k === "all" ? customers.length : customers.filter((c) => c.customer.status === k).length,
        }))}
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState title="Илэрц алга" sub={q ? `«${q}» гэсэн хайлтад тохирох харилцагч байхгүй` : "Энэ төлөвт харилцагч алга"} />
        </div>
      ) : (
        <CustomersGrid rows={rows.map((row) => toCustomerGridRow(row, latest?.tagName ?? null))} />
      )}
      {pending > 0 && status !== "pending" ? (
        <p className="text-xs text-text-3">
          {pending} бүртгүүлэх хүсэлт хүлээгдэж байна — батлахаас өмнө <Link href="/customers?status=pending" className="underline">хүсэлтийг</Link> нээж код, багцыг шалгана.
        </p>
      ) : null}
    </div>
  );
}
