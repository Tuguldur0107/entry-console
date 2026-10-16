// Core-ийн туршилтын funnel ба AI tool-ийн хэрэглээний тайлан — ТӨРӨЛ + ЦЭВЭР туслах
// (DB/fetch импортгүй, tests/saas-insights.test.ts). Эх: core
// lib/platform/trial-funnel.ts, lib/ai-logging/tool-usage.ts — талбарын нэр ЯГ тэр.
// Core-ийн хуучин хувилбар талбар дутуу ирүүлж болох тул тоо ЗОХИОХГҮЙ: алга бол null / «—».

export type FunnelStageKey = "signed_up" | "connected" | "master_data" | "first_journal" | "paid";
export type FunnelProduct = "accounting" | "skills";

export const FUNNEL_PRODUCTS: { value: FunnelProduct; label: string }[] = [
  { value: "accounting", label: "Нягтлан бодох систем" },
  { value: "skills", label: "AI нягтлан" },
];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  signed_up: "Бүртгүүлсэн",
  connected: "AI холбосон",
  master_data: "Мастер дата",
  first_journal: "Анхны журнал",
  paid: "Төлсөн",
};

export type FunnelStageStat = {
  key: FunnelStageKey;
  label: string;
  count: number;
  reachedAnyOrder: number;
  rateFromSignup: number | null;
  rateFromPrevious: number | null;
  medianHoursFromSignup: number | null;
};

export type TrialFunnelOrgRow = {
  organizationId: string;
  orgName: string;
  createdAt: string;
  planId: string | null;
  lastStage: FunnelStageKey;
  connectedAt: string | null;
  masterDataAt: string | null;
  firstJournalAt: string | null;
  paidAt: string | null;
  manuallyConverted: boolean;
  welcomeDismissed: boolean;
};

export type TrialFunnel = {
  product: FunnelProduct;
  from: string;
  to: string;
  cohortSize: number;
  stages: FunnelStageStat[];
  excluded: { demo: number; additionalCompany: number; otherProduct: number };
  welcomeDismissed: number;
  orgs: TrialFunnelOrgRow[];
};

export type ToolUsageSummary = {
  toolName: string;
  calls: number;
  errors: number;
  errorRate: number;
  organizations: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  bySource: Record<string, number>;
  errorCodes: { code: string; calls: number }[];
  writes: {
    suggestions: number;
    accepted: number;
    modified: number;
    rejected: number;
    noAction: number;
    posted: number;
    reversed: number;
  } | null;
};

export type ToolUsageReport = {
  from: string;
  to: string;
  totals: { calls: number; errors: number; errorRate: number; organizations: number; toolsUsed: number };
  tools: ToolUsageSummary[];
  unusedTools: string[];
  countingSince: string | null;
};

/** Хуудасны мужийн сонголт (сүүлийн N хоног) — URL `?days=`. */
export const RANGE_OPTIONS = [7, 30, 90, 180] as const;

export function parseDays(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

/** УБ-ын өнөөдрөөс `days` хоногийн муж (YYYY-MM-DD) — core-ийн `from`/`to`. */
export function rangeForDays(days: number, now: Date = new Date()): { from: string; to: string } {
  const ub = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
  const to = ub(now);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: start.toISOString().slice(0, 10), to };
}

/** 0–1 → «42%» (нэг оронтой бутархайгүй); null → «—». */
export function fmtRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const pct = rate * 100;
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%`;
}

/** Цаг → «35 мин» / «6 цаг» / «3.5 өдөр»; null → «—». */
export function fmtHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} мин`;
  if (hours < 48) return `${Math.round(hours)} цаг`;
  const days = hours / 24;
  return `${days >= 10 ? Math.round(days) : days.toFixed(1)} өдөр`;
}

/** Хамгийн том алдагдал = дараалсан хоёр алхмын хооронд хамгийн бага хувь (count > 0). */
export function biggestDropOff(stages: FunnelStageStat[]): { from: FunnelStageStat; to: FunnelStageStat } | null {
  let worst: { from: FunnelStageStat; to: FunnelStageStat } | null = null;
  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1];
    const stage = stages[i];
    if (prev.count === 0 || stage.rateFromPrevious == null) continue;
    if (!worst || stage.rateFromPrevious < (worst.to.rateFromPrevious ?? 1)) worst = { from: prev, to: stage };
  }
  return worst && (worst.to.rateFromPrevious ?? 1) < 1 ? worst : null;
}

/** Байгууллагын мөрд алхмын огноо (хүрээгүй бол null). */
export function stageDate(row: TrialFunnelOrgRow, key: FunnelStageKey): string | null {
  switch (key) {
    case "signed_up":
      return row.createdAt;
    case "connected":
      return row.connectedAt;
    case "master_data":
      return row.masterDataAt;
    case "first_journal":
      return row.firstJournalAt;
    case "paid":
      return row.paidAt;
  }
}

/** Алдааны хувийн өнгө: ≥20% danger, ≥5% warning. */
export function errorTone(rate: number): "danger" | "warning" | null {
  if (rate >= 0.2) return "danger";
  if (rate >= 0.05) return "warning";
  return null;
}

/** Бичих tool-ийн саналын хүлээн авалт = (хүлээн авсан + засварласан) / санал. */
export function writeAcceptance(writes: ToolUsageSummary["writes"]): number | null {
  if (!writes || writes.suggestions === 0) return null;
  return (writes.accepted + writes.modified) / writes.suggestions;
}

/** Бүх бичих tool-ийн нийт хүлээн авалт; санал алга бол rate null. */
export function totalWriteAcceptance(tools: ToolUsageSummary[]): { suggestions: number; rate: number | null } {
  let suggestions = 0;
  let kept = 0;
  for (const tool of tools) {
    if (!tool.writes) continue;
    suggestions += tool.writes.suggestions;
    kept += tool.writes.accepted + tool.writes.modified;
  }
  return { suggestions, rate: suggestions ? kept / suggestions : null };
}
