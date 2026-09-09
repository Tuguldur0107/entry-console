import Link from "next/link";

import type { Health, WorkflowRun } from "@/lib/github";
import type { CustomerPlan, CustomerStatus } from "@/lib/db/schema";

export const PLAN_LABELS: Record<CustomerPlan, string> = { pilot: "Туршилт", basic: "Basic", pro: "Pro" };
export const STATUS_LABELS: Record<CustomerStatus, string> = {
  provisioning: "Үүсгэж байна",
  active: "Идэвхтэй",
  suspended: "Түр зогссон",
  archived: "Архив",
};
const STATUS_TONE: Record<CustomerStatus, string> = {
  provisioning: "badge-warning",
  active: "badge-success",
  suspended: "badge-danger",
  archived: "badge-muted",
};

export const fmtMnt = (v: string | number) => `${new Intl.NumberFormat("en-US").format(Math.round(Number(v)))} ₮`;

export function fmtDate(iso: string | Date | null, withTime = true): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

export function fmtAgo(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "саяхан";
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} цаг`;
  return `${Math.round(h / 24)} өдөр`;
}

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function HealthBadge({ health, behind, latest }: { health: Health | null; behind: boolean | null; latest: string | null }) {
  if (!health) return <span className="badge badge-muted badge-plain">хаяг алга</span>;
  if (!health.ok) return <span className="badge badge-danger" title={health.error}>хүрэхгүй</span>;
  if (behind) return <span className="badge badge-warning" title={`Core: ${latest ?? "?"}`}>v{health.version} · хоцорсон</span>;
  return <span className="badge badge-success">v{health.version ?? "?"}</span>;
}

export function RunBadge({ run }: { run: WorkflowRun | null }) {
  if (!run) return <span className="badge badge-muted badge-plain">—</span>;
  const cls = run.status !== "completed" ? "badge-warning" : run.conclusion === "success" ? "badge-success" : "badge-danger";
  const label = run.status !== "completed" ? "ажиллаж байна" : run.conclusion === "success" ? "амжилттай" : (run.conclusion ?? "алдаа");
  return (
    <a href={run.htmlUrl} target="_blank" rel="noreferrer" className={`badge ${cls}`} title={fmtDate(run.createdAt)}>
      {label}
    </a>
  );
}

export function Kpi({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "danger"; href?: string }) {
  const color = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  const body = (
    <div className="card kpi h-full">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-text-3">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {sub && <p className="mt-1 text-sm text-text-3">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Section({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="card-title">{title}</h2>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
