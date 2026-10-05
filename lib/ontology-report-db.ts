// Ontology-ийн тайлан — СЕРВЕР талын хэсэг: health татах, тохиргоо, түүх, хуваарь.
// Цэвэр логик (задлал, хуваарь, текст) нь lib/ontology-report.ts.
//
// Хуваарьт тайланг хяналтын cron (5 мин тутам, lib/monitor.ts) дуудна — тусдаа cron
// service хэрэггүй. Тохиргоо `console_state`-ийн `ontology.report.settings`-д.
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { config } from "./config";
import { db } from "./db";
import { ensureSchema } from "./db/ensure";
import { consoleState, customers, ontologyReports, type OntologyReportRow } from "./db/schema";
import { notify } from "./notify";
import {
  buildReport,
  lastScheduledAt,
  normalizeReportSettings,
  parseOntologyHealth,
  reportDue,
  reportText,
  shouldNotify,
  type OntologyReport,
  type OntologyReportSettings,
  type OntologyTargetKind,
  type OntologyTargetResult,
} from "./ontology-report";

const SETTINGS_KEY = "ontology.report.settings";
const CLAIM_KEY = "ontology.report.claim";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Target = { name: string; url: string; kind: OntologyTargetKind; slug: string | null };

/** Тайлангийн хамрах хүрээ: үндсэн SaaS + идэвхтэй dedicated харилцагч бүр. */
export async function ontologyTargets(): Promise<Target[]> {
  await ensureSchema();
  const out: Target[] = [];
  if (config.saas) out.push({ name: "Entry SaaS", url: config.saas.apiUrl, kind: "saas", slug: null });
  const rows = await db
    .select({ slug: customers.slug, name: customers.displayName, url: customers.appUrl })
    .from(customers)
    .where(and(inArray(customers.status, ["active"]), isNotNull(customers.appUrl)))
    .orderBy(customers.displayName);
  const seen = new Set(out.map((t) => t.url));
  for (const r of rows) {
    const url = (r.url ?? "").replace(/\/+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ name: r.name, url, kind: "dedicated", slug: r.slug });
  }
  return out;
}

async function probe(target: Target): Promise<OntologyTargetResult> {
  const base = { ...target, url: target.url.replace(/\/+$/, "") };
  try {
    const response = await fetch(`${base.url}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const json = (await response.json()) as { ok?: boolean; version?: string; error?: string };
    return {
      ...base,
      reachable: response.ok && json.ok === true,
      version: typeof json.version === "string" ? json.version : null,
      ontology: parseOntologyHealth(json),
      error: json.ok === true ? null : (json.error ?? `HTTP ${response.status}`),
    };
  } catch (error) {
    return { ...base, reachable: false, version: null, ontology: null, error: msg(error) };
  }
}

/** Бүх deployment-ийн одоогийн төлөв (хадгалахгүй, илгээхгүй) — хуудас нээх бүрд. */
export async function collectOntologyStatus(now = new Date()): Promise<OntologyReport> {
  const targets = await ontologyTargets();
  return buildReport(await Promise.all(targets.map(probe)), "manual", now);
}

export async function getReportSettings(): Promise<OntologyReportSettings> {
  await ensureSchema();
  const row = await db.query.consoleState.findFirst({ where: eq(consoleState.key, SETTINGS_KEY) });
  return normalizeReportSettings(row?.value);
}

export async function saveReportSettings(settings: OntologyReportSettings): Promise<void> {
  await ensureSchema();
  const now = new Date();
  await db
    .insert(consoleState)
    .values({ key: SETTINGS_KEY, value: settings, updatedAt: now })
    .onConflictDoUpdate({ target: consoleState.key, set: { value: settings, updatedAt: now } });
}

export async function listReports(limit = 30): Promise<OntologyReportRow[]> {
  await ensureSchema();
  return db.select().from(ontologyReports).orderBy(desc(ontologyReports.createdAt)).limit(limit);
}

async function lastScheduledRunAt(): Promise<Date | null> {
  const [row] = await db
    .select({ at: ontologyReports.createdAt })
    .from(ontologyReports)
    .where(eq(ontologyReports.trigger, "schedule"))
    .orderBy(desc(ontologyReports.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/** Тайлан гаргаж хадгална, тохиргооны дагуу мэдэгдэнэ. */
export async function runOntologyReport(trigger: OntologyReport["trigger"], now = new Date()): Promise<{ report: OntologyReport; notified: boolean }> {
  const [settings, targets] = await Promise.all([getReportSettings(), ontologyTargets()]);
  const report = buildReport(await Promise.all(targets.map(probe)), trigger, now);
  const notified = shouldNotify(settings, report) ? await notify(reportText(report, config.self.publicUrl)) : false;
  await db.insert(ontologyReports).values({
    trigger,
    last7d: report.last7d,
    attention: report.attention,
    data: report.targets,
    notified,
    createdAt: now,
  });
  return { report, notified };
}

/**
 * Хяналтын cron-оос: хуваарийн цаг болсон бол НЭГ удаа гаргана. Зэрэгцээ хоёр cron
 * дуудлага давхар илгээхгүй — хуваарийн цэгийг `console_state`-д нөхцөлтэй upsert-ээр
 * эзэмшсэн нь л гаргана.
 */
export async function runScheduledOntologyReport(now = new Date()): Promise<OntologyReport | null> {
  await ensureSchema();
  const settings = await getReportSettings();
  if (!reportDue(settings, await lastScheduledRunAt(), now)) return null;
  // Хуваарийн цэгийг эзэмшинэ: өөр дуудлага ижил цэгийг аль хэдийн авсан бол 0 мөр.
  const slot = lastScheduledAt(settings, now).toISOString();
  const claimed = await db
    .insert(consoleState)
    .values({ key: CLAIM_KEY, value: { slot }, updatedAt: now })
    .onConflictDoUpdate({
      target: consoleState.key,
      set: { value: { slot }, updatedAt: now },
      setWhere: sql`${consoleState.value}->>'slot' is distinct from ${slot}`,
    })
    .returning({ key: consoleState.key });
  if (claimed.length === 0) return null;
  const { report } = await runOntologyReport("schedule", now);
  return report;
}
