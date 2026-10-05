// Ontology-ийн долоо хоногийн тайлан — ЦЭВЭР (DB импортгүй, тесттэй).
//
// Core (entry-accounting) deployment бүрийн `/api/health` нь `ontology` хэсэгтэй:
//   { enforce: ["gl", …], unknown: [], violations: { last7d, byObject, total, lastAt } | null }
// `violations` нь registry-д бүртгэлгүй төлвийн шилжилт (core docs/dev/ontology.md §5a) —
// v1.9.0-ээс хойшхи хувилбарт л байна (хуучин нь `null` = «мэдээлэлгүй», 0 БИШ).
// Тайлан нь эдгээрийг нэгтгэж Telegram / webhook-оор илгээнэ; хуваарь (гараг, цаг)
// Console-ийн /ontology хуудаснаас тохируулагдана.

export type OntologyViolations = {
  last7d: number;
  byObject: Record<string, number>;
  total: number;
  lastAt: string | null;
};

export type OntologyHealth = {
  /** Мөрдөх горимын модулиуд (`ONTOLOGY_ENFORCE`); хоосон = ажиглах горим. */
  enforce: string[];
  /** `ONTOLOGY_ENFORCE`-ийн танигдаагүй утга (үсгийн алдаа). */
  unknown: string[];
  /** null = энэ хувилбар зөрчлийн тоо өгдөггүй (эсвэл DB уншиж чадаагүй). */
  violations: OntologyViolations | null;
};

export type OntologyTargetKind = "saas" | "dedicated";

export type OntologyTargetResult = {
  name: string;
  url: string;
  kind: OntologyTargetKind;
  /** Харилцагчийн slug (dedicated) — дэлгэрэнгүй рүү холбоно. */
  slug: string | null;
  /** /api/health хүрсэн бөгөөд `ok: true`. */
  reachable: boolean;
  version: string | null;
  ontology: OntologyHealth | null;
  error: string | null;
};

export type OntologyReport = {
  at: string;
  trigger: "schedule" | "manual";
  targets: OntologyTargetResult[];
  /** Сүүлийн 7 хоногийн зөрчлийн нийлбэр (тоо өгсөн deployment-уудаас). */
  last7d: number;
  /** Зөрчил ≥ 1, хүрэхгүй, эсвэл ONTOLOGY_ENFORCE-д алдаатай deployment-ийн тоо. */
  attention: number;
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** Health JSON-ийн `ontology` хэсгийг уучлалтайгаар задлана (хуучин хувилбарт хэсэг алга). */
export function parseOntologyHealth(json: unknown): OntologyHealth | null {
  if (!json || typeof json !== "object") return null;
  const raw = (json as { ontology?: unknown }).ontology;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { enforce?: unknown; unknown?: unknown; violations?: unknown };
  let violations: OntologyViolations | null = null;
  if (o.violations && typeof o.violations === "object") {
    const v = o.violations as { last7d?: unknown; byObject?: unknown; total?: unknown; lastAt?: unknown };
    const byObject: Record<string, number> = {};
    if (v.byObject && typeof v.byObject === "object")
      for (const [key, count] of Object.entries(v.byObject as Record<string, unknown>)) if (num(count) > 0) byObject[key] = num(count);
    violations = {
      last7d: num(v.last7d),
      byObject,
      total: num(v.total),
      lastAt: typeof v.lastAt === "string" ? v.lastAt : null,
    };
  }
  return { enforce: strings(o.enforce), unknown: strings(o.unknown), violations };
}

export function needsAttention(target: OntologyTargetResult): boolean {
  if (!target.reachable) return true;
  if (!target.ontology) return false;
  return (target.ontology.violations?.last7d ?? 0) > 0 || target.ontology.unknown.length > 0;
}

export function buildReport(targets: OntologyTargetResult[], trigger: OntologyReport["trigger"], now: Date): OntologyReport {
  return {
    at: now.toISOString(),
    trigger,
    targets,
    last7d: targets.reduce((sum, t) => sum + (t.ontology?.violations?.last7d ?? 0), 0),
    attention: targets.filter(needsAttention).length,
  };
}

// ── Тохиргоо, хуваарь ────────────────────────────────────────────────────────

/** 0 = Ням … 6 = Бямба (JS `getUTCDay`-тэй ижил). */
export const WEEKDAY_LABELS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"] as const;

export type OntologyReportSettings = {
  enabled: boolean;
  /** 0–6, 0 = Ням. */
  weekday: number;
  /** Улаанбаатарын цаг, 0–23. */
  hour: number;
  /** true = зөрчил / асуудал байвал л мэдэгдэнэ (тайлан ч хадгалагдана). */
  onlyOnIssues: boolean;
  /** Тохиргоо хадгалсан цаг — үүнээс өмнөх хуваарийн цэгийг «хоцорсон» гэж үзэхгүй. */
  savedAt: string | null;
};

export const DEFAULT_REPORT_SETTINGS: OntologyReportSettings = {
  enabled: true,
  weekday: 1,
  hour: 9,
  onlyOnIssues: false,
  savedAt: null,
};

/** Улаанбаатар = UTC+8, зуны цаггүй. */
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const intIn = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** DB-ийн jsonb (эсвэл хоосон) → бүрэн тохиргоо. */
export function normalizeReportSettings(raw: unknown): OntologyReportSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_REPORT_SETTINGS.enabled,
    weekday: intIn(r.weekday, 0, 6, DEFAULT_REPORT_SETTINGS.weekday),
    hour: intIn(r.hour, 0, 23, DEFAULT_REPORT_SETTINGS.hour),
    onlyOnIssues: typeof r.onlyOnIssues === "boolean" ? r.onlyOnIssues : DEFAULT_REPORT_SETTINGS.onlyOnIssues,
    savedAt: typeof r.savedAt === "string" ? r.savedAt : null,
  };
}

/** Маягт → тохиргоо; буруу утгад алдааны текст. */
export function parseReportSettingsForm(
  form: { enabled: boolean; weekday: string; hour: string; onlyOnIssues: boolean },
  now: Date
): { ok: true; settings: OntologyReportSettings } | { ok: false; error: string } {
  const weekday = intIn(form.weekday, 0, 6, -1);
  if (weekday < 0) return { ok: false, error: "Гараг буруу" };
  const hour = intIn(form.hour, 0, 23, -1);
  if (hour < 0) return { ok: false, error: "Цаг 0–23 байх ёстой" };
  return { ok: true, settings: { enabled: form.enabled, weekday, hour, onlyOnIssues: form.onlyOnIssues, savedAt: now.toISOString() } };
}

/** `now`-оос өмнөх (эсвэл яг тэр) хамгийн сүүлийн хуваарийн цэг — UTC Date. */
export function lastScheduledAt(settings: OntologyReportSettings, now: Date): Date {
  const ub = new Date(now.getTime() + UB_OFFSET_MS);
  const dayDiff = (ub.getUTCDay() - settings.weekday + 7) % 7;
  const slotUb = Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() - dayDiff, settings.hour);
  let slot = slotUb - UB_OFFSET_MS;
  if (slot > now.getTime()) slot -= WEEK_MS;
  return new Date(slot);
}

export function nextScheduledAt(settings: OntologyReportSettings, now: Date): Date {
  return new Date(lastScheduledAt(settings, now).getTime() + WEEK_MS);
}

/**
 * Хуваарьт тайлан одоо гаргах уу. Сүүлийн хуваарийн цэг нь өмнөх хуваарьт тайлан
 * БА тохиргоо хадгалсан цагаас хойш бол — тохиргоо солимогц шууд цацахгүй, cron
 * хэдэн минут хоцорсон ч алгасахгүй. Хоёр долоо хоног зогссон ч НЭГ л тайлан.
 */
export function reportDue(settings: OntologyReportSettings, lastScheduledRunAt: Date | null, now: Date): boolean {
  if (!settings.enabled) return false;
  const slot = lastScheduledAt(settings, now).getTime();
  if (lastScheduledRunAt && lastScheduledRunAt.getTime() >= slot) return false;
  if (settings.savedAt && Date.parse(settings.savedAt) > slot) return false;
  return true;
}

/** Мэдэгдэл илгээх үү (тайлан үргэлж хадгалагдана). */
export function shouldNotify(settings: OntologyReportSettings, report: OntologyReport): boolean {
  return report.trigger === "manual" || !settings.onlyOnIssues || report.attention > 0;
}

// ── Мэдэгдлийн текст ─────────────────────────────────────────────────────────

function targetLine(t: OntologyTargetResult): string {
  const head = `${t.name}${t.version ? ` v${t.version}` : ""}`;
  if (!t.reachable) return `🔴 ${head} — хүрэхгүй${t.error ? `: ${t.error}` : ""}`;
  const o = t.ontology;
  if (!o) return `⚪ ${head} — ontology мэдээлэлгүй (хуучин хувилбар)`;
  const mode = o.enforce.length ? `мөрдөх: ${o.enforce.join(",")}` : "ажиглах";
  const typo = o.unknown.length ? ` · ⚠️ ONTOLOGY_ENFORCE танигдаагүй: ${o.unknown.join(",")}` : "";
  if (!o.violations) return `⚪ ${head} — зөрчлийн тоо өгдөггүй (v1.9.0-ээс хойшхи хувилбар хэрэгтэй) · ${mode}${typo}`;
  const v = o.violations;
  if (v.last7d === 0) return `${typo ? "🟡" : "🟢"} ${head} — 7 хоногт 0 зөрчил · ${mode}${typo}`;
  const top = Object.entries(v.byObject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => `${key} ${count}`)
    .join(", ");
  return `🟠 ${head} — 7 хоногт ${v.last7d} зөрчил${top ? ` (${top})` : ""} · ${mode}${typo}`;
}

export function reportText(report: OntologyReport, consoleUrl: string | null): string {
  const title = report.trigger === "manual" ? "🧭 Ontology тайлан (гараар)" : "🧭 Ontology — долоо хоногийн тайлан";
  const summary =
    report.attention === 0
      ? `Бүгд цэвэр — 7 хоногт ${report.last7d} зөрчил.`
      : `${report.attention} deployment анхаарах · 7 хоногт нийт ${report.last7d} зөрчил.`;
  const lines = [title, summary, "", ...report.targets.map(targetLine)];
  if (report.last7d === 0 && report.attention === 0)
    lines.push("", "Хэдэн долоо хоног 0 үргэлжилбэл ONTOLOGY_ENFORCE=gl-ээс эхлэн мөрдөх горимд шилжиж болно.");
  if (consoleUrl) lines.push("", `${consoleUrl}/ontology`);
  return lines.join("\n");
}

// ── Хүснэгтийн мөр ───────────────────────────────────────────────────────────

export type TargetState = "ok" | "violations" | "down" | "nodata" | "typo";

export type TargetStatus = {
  state: TargetState;
  /** «ажиглах» эсвэл «мөрдөх: gl,ar» */
  mode: string;
  last7d: number | null;
  total: number | null;
  /** Объектоор, ихээс бага руу: «journal_vouchers 3, ar_ap_documents 1» */
  top: string;
  lastAt: string | null;
  note: string | null;
};

export function targetStatus(t: OntologyTargetResult): TargetStatus {
  const o = t.ontology;
  const v = o?.violations ?? null;
  const mode = !o ? "—" : o.enforce.length ? `мөрдөх: ${o.enforce.join(",")}` : "ажиглах";
  const top = v
    ? Object.entries(v.byObject)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => `${key} ${count}`)
        .join(", ")
    : "";
  const base = { mode, last7d: v?.last7d ?? null, total: v?.total ?? null, top, lastAt: v?.lastAt ?? null };
  if (!t.reachable) return { ...base, state: "down", note: t.error ?? "хүрэхгүй" };
  if (!o) return { ...base, state: "nodata", note: "health-д ontology хэсэг алга — хуучин хувилбар" };
  if (o.unknown.length) return { ...base, state: "typo", note: `ONTOLOGY_ENFORCE танигдаагүй: ${o.unknown.join(", ")}` };
  if (!v) return { ...base, state: "nodata", note: "зөрчлийн тоо өгдөггүй — v1.9.0-ээс хойшхи хувилбар хэрэгтэй" };
  if (v.last7d > 0) return { ...base, state: "violations", note: null };
  return { ...base, state: "ok", note: null };
}

/** Түүхийн мөрийн товч: «Entry SaaS 0 · SmartGPS — · …» */
export function reportDetail(targets: OntologyTargetResult[]): string {
  return targets
    .map((t) => `${t.name} ${!t.reachable ? "✕" : t.ontology?.violations ? t.ontology.violations.last7d : "—"}`)
    .join(" · ");
}
