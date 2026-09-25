import Link from "next/link";

import { Icons } from "./icons";

import type { Health, WorkflowRun } from "@/lib/github";
import type { CustomerPlan, CustomerStatus } from "@/lib/db/schema";

export const PLAN_LABELS: Record<CustomerPlan, string> = { pilot: "Туршилт", basic: "Basic", pro: "Pro" };
export const STATUS_LABELS: Record<CustomerStatus, string> = {
  pending: "Хүсэлт",
  provisioning: "Үүсгэж байна",
  active: "Идэвхтэй",
  suspended: "Түр зогссон",
  archived: "Архив",
  rejected: "Татгалзсан",
};
export const SOURCE_LABELS: Record<string, string> = { console: "Console", signup: "Бүртгүүлэх хуудас", api: "REST API" };
export const EVENT_LABELS: Record<string, string> = {
  provisioned: "Үүсгэлт",
  activated: "Идэвхжсэн",
  sync: "Sync",
  invite: "Урилга",
  status: "Төлөв",
  note: "Тэмдэглэл",
  billing: "Төлбөр",
  deploy: "Deploy",
  alert: "Мэдэгдэл",
  request: "Хүсэлт",
  approved: "Батлагдсан",
  rejected: "Татгалзсан",
  access: "Эрх",
};
const STATUS_TONE: Record<CustomerStatus, string> = {
  pending: "badge-info",
  provisioning: "badge-warning",
  active: "badge-success",
  suspended: "badge-danger",
  archived: "badge-muted",
  rejected: "badge-muted",
};

// Тэмдэг нь тооноосоо ТАСРАХГҮЙ — нарийн баганад "100,000" / "₮" гэж хоёр мөр
// болохгүйн тулд ЗАЙГҮЙ ЗАЙ (U+00A0).
export const fmtMnt = (v: string | number) =>
  `${new Intl.NumberFormat("en-US").format(Math.round(Number(v)))}\u00A0₮`;

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

/**
 * Авто sync-ийн төлөв. `monitor.ts`-ийн нөхцөлтэй ИЖИЛ: эрхгүй бол асаалттай
 * байсан ч ажиллахгүй тул «эрхгүй» гэж ил хэлнэ (худал ногоон гаргахгүй).
 */
export function AutoSyncBadge({ on, access, status }: { on: boolean; access: boolean; status: CustomerStatus }) {
  if (status !== "active") return <span className="text-text-3">—</span>;
  if (!access) return <span className="badge badge-muted" title="Шинэчлэлт авах эрх цуцлагдсан — sync ажиллахгүй">эрхгүй</span>;
  if (!on) return <span className="badge badge-warning" title="Release бүрд гараар merge хийнэ">гараар</span>;
  return <span className="badge badge-success" title="Шалгалт давсан sync PR автоматаар merge хийгдэнэ">авто</span>;
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

export function Section({ title, sub, children, right, className }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Хуудасны төлөв/шүүлтүүрийн chip — URL-ээр (deep link, server шүүлт).
 * Хуудас бүрд өөр хэв маяг (badge / btn) байсныг НЭГ болгов.
 */
export function FilterChips({ items, active }: { items: { value: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Шүүлтүүр" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {items.map((item) => {
        const on = item.value === active;
        return (
          <Link key={item.value || "all"} href={item.href} aria-current={on ? "page" : undefined} className="filter-chip" data-active={on}>
            {item.label}
            {item.count !== undefined ? <span className="filter-chip-count">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** GET хайлтын форм — дүрс нь бичвэртэй давхцахгүй (`.input`-ийн padding `pl-9`-ийг дардаг байв). */
export function SearchForm({ q, placeholder, hidden, className }: { q?: string; placeholder: string; hidden?: Record<string, string>; className?: string }) {
  return (
    <form className={`flex items-center gap-2 ${className ?? ""}`} method="get" role="search">
      <label className="search-field min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <Icons.search aria-hidden />
        <input name="q" defaultValue={q ?? ""} className="input" placeholder={placeholder} type="search" />
      </label>
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <button className="btn" type="submit">Хайх</button>
    </form>
  );
}
