import type { Health, WorkflowRun } from "@/lib/github";

export function HealthBadge({ health, behind, latest }: { health: Health | null; behind: boolean | null; latest: string | null }) {
  if (!health) return <span className="badge badge-muted">URL тохируулаагүй</span>;
  if (!health.ok) return <span className="badge badge-danger" title={health.error}>● Хүрэхгүй</span>;
  if (behind)
    return (
      <span className="badge badge-warning" title={`Core: ${latest ?? "?"}`}>
        v{health.version} · хоцорсон
      </span>
    );
  return <span className="badge badge-success">v{health.version ?? "?"} · шинэ</span>;
}

export function RunBadge({ run }: { run: WorkflowRun | null }) {
  if (!run) return <span className="badge badge-muted">—</span>;
  const cls =
    run.status !== "completed"
      ? "badge-warning"
      : run.conclusion === "success"
        ? "badge-success"
        : "badge-danger";
  const label =
    run.status !== "completed"
      ? "ажиллаж байна"
      : run.conclusion === "success"
        ? "амжилттай"
        : (run.conclusion ?? "алдаа");
  return (
    <a href={run.htmlUrl} target="_blank" rel="noreferrer" className={`badge ${cls}`}>
      {label}
    </a>
  );
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
