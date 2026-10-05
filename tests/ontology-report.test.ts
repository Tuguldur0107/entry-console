import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReport,
  DEFAULT_REPORT_SETTINGS,
  lastScheduledAt,
  nextScheduledAt,
  normalizeReportSettings,
  parseOntologyHealth,
  parseReportSettingsForm,
  reportDue,
  reportText,
  shouldNotify,
  targetStatus,
  type OntologyReportSettings,
  type OntologyTargetResult,
} from "../lib/ontology-report";

const settings = (patch: Partial<OntologyReportSettings> = {}): OntologyReportSettings => ({ ...DEFAULT_REPORT_SETTINGS, ...patch });

function target(patch: Partial<OntologyTargetResult> = {}): OntologyTargetResult {
  return {
    name: "Entry SaaS",
    url: "https://app.entry.mn",
    kind: "saas",
    slug: null,
    reachable: true,
    version: "1.9.0",
    ontology: { enforce: [], unknown: [], violations: { last7d: 0, byObject: {}, total: 0, lastAt: null } },
    error: null,
    ...patch,
  };
}

test("parseOntologyHealth: v1.9.0+ бүтэн хэсэг", () => {
  const o = parseOntologyHealth({
    ok: true,
    ontology: { enforce: ["gl"], unknown: ["gll"], violations: { last7d: 3, byObject: { journal_vouchers: 3, x: 0 }, total: 5, lastAt: "2026-10-04T00:00:00Z" } },
  });
  assert.deepEqual(o, { enforce: ["gl"], unknown: ["gll"], violations: { last7d: 3, byObject: { journal_vouchers: 3 }, total: 5, lastAt: "2026-10-04T00:00:00Z" } });
});

test("parseOntologyHealth: violations алга бол null (0 БИШ), ontology алга бол null", () => {
  assert.deepEqual(parseOntologyHealth({ ok: true, ontology: { enforce: [], unknown: [] } }), { enforce: [], unknown: [], violations: null });
  assert.equal(parseOntologyHealth({ ok: true, version: "1.8.0" }), null);
  assert.equal(parseOntologyHealth(null), null);
});

test("parseOntologyHealth: буруу төрлийг уучилна", () => {
  const o = parseOntologyHealth({ ontology: { enforce: "gl", violations: { last7d: -1, byObject: { a: "2" }, total: 1.7 } } });
  assert.deepEqual(o, { enforce: [], unknown: [], violations: { last7d: 0, byObject: {}, total: 1, lastAt: null } });
});

test("targetStatus: төлвийн ангилал", () => {
  assert.equal(targetStatus(target()).state, "ok");
  assert.equal(targetStatus(target({ reachable: false, error: "timeout" })).state, "down");
  assert.equal(targetStatus(target({ ontology: null })).state, "nodata");
  assert.equal(targetStatus(target({ ontology: { enforce: [], unknown: [], violations: null } })).state, "nodata");
  assert.equal(targetStatus(target({ ontology: { enforce: [], unknown: ["gll"], violations: null } })).state, "typo");
  const v = targetStatus(target({ ontology: { enforce: ["gl"], unknown: [], violations: { last7d: 4, byObject: { a: 1, b: 3 }, total: 9, lastAt: null } } }));
  assert.equal(v.state, "violations");
  assert.equal(v.top, "b 3, a 1");
  assert.equal(v.mode, "мөрдөх: gl");
});

test("buildReport: нийлбэр ба анхаарах", () => {
  const r = buildReport(
    [
      target(),
      target({ name: "SmartGPS", ontology: { enforce: [], unknown: [], violations: null } }),
      target({ name: "A", ontology: { enforce: [], unknown: [], violations: { last7d: 2, byObject: { a: 2 }, total: 2, lastAt: null } } }),
      target({ name: "B", reachable: false }),
    ],
    "schedule",
    new Date("2026-10-05T01:00:00Z")
  );
  assert.equal(r.last7d, 2);
  assert.equal(r.attention, 2);
});

test("lastScheduledAt: Даваа 09:00 УБ = Даваа 01:00 UTC", () => {
  const s = settings({ weekday: 1, hour: 9 });
  // 2026-10-05 бол Даваа. 10:00 УБ = 02:00 UTC → өнөөдрийн цэг
  assert.equal(lastScheduledAt(s, new Date("2026-10-05T02:00:00Z")).toISOString(), "2026-10-05T01:00:00.000Z");
  // 08:59 УБ → өмнөх Даваа
  assert.equal(lastScheduledAt(s, new Date("2026-10-05T00:59:00Z")).toISOString(), "2026-09-28T01:00:00.000Z");
  // Яг цагтаа
  assert.equal(lastScheduledAt(s, new Date("2026-10-05T01:00:00Z")).toISOString(), "2026-10-05T01:00:00.000Z");
  assert.equal(nextScheduledAt(s, new Date("2026-10-05T02:00:00Z")).toISOString(), "2026-10-12T01:00:00.000Z");
});

test("lastScheduledAt: УБ-ын шөнө дунд UTC-ийн өмнөх өдөр", () => {
  // Ням 02:00 УБ = Бямба 18:00 UTC
  const s = settings({ weekday: 0, hour: 2 });
  assert.equal(lastScheduledAt(s, new Date("2026-10-04T00:00:00Z")).toISOString(), "2026-10-03T18:00:00.000Z");
});

test("reportDue: цэг өнгөрсөн, өмнө нь гараагүй бол л", () => {
  const s = settings({ weekday: 1, hour: 9, savedAt: "2026-09-01T00:00:00Z" });
  const now = new Date("2026-10-05T01:05:00Z");
  assert.equal(reportDue(s, null, now), true);
  assert.equal(reportDue(s, new Date("2026-09-28T01:05:00Z"), now), true);
  assert.equal(reportDue(s, new Date("2026-10-05T01:00:00Z"), now), false);
  assert.equal(reportDue({ ...s, enabled: false }, null, now), false);
});

test("reportDue: тохиргоо цэгийн ДАРАА хадгалсан бол дараагийн цэгийг хүлээнэ", () => {
  const s = settings({ weekday: 1, hour: 9, savedAt: "2026-10-05T03:00:00Z" });
  assert.equal(reportDue(s, null, new Date("2026-10-05T03:05:00Z")), false);
  assert.equal(reportDue(s, null, new Date("2026-10-12T01:00:00Z")), true);
});

test("shouldNotify: onlyOnIssues нь хуваарьт цэвэр тайланг чимээгүй болгоно, гараар үргэлж", () => {
  const clean = buildReport([target()], "schedule", new Date());
  const issue = buildReport([target({ reachable: false })], "schedule", new Date());
  assert.equal(shouldNotify(settings(), clean), true);
  assert.equal(shouldNotify(settings({ onlyOnIssues: true }), clean), false);
  assert.equal(shouldNotify(settings({ onlyOnIssues: true }), issue), true);
  assert.equal(shouldNotify(settings({ onlyOnIssues: true }), { ...clean, trigger: "manual" }), true);
});

test("normalizeReportSettings / parseReportSettingsForm", () => {
  assert.deepEqual(normalizeReportSettings(undefined), DEFAULT_REPORT_SETTINGS);
  assert.deepEqual(normalizeReportSettings({ weekday: 9, hour: "7", enabled: false }), { ...DEFAULT_REPORT_SETTINGS, hour: 7, enabled: false });
  const now = new Date("2026-10-05T00:00:00Z");
  const ok = parseReportSettingsForm({ enabled: true, weekday: "5", hour: "18", onlyOnIssues: true }, now);
  assert.deepEqual(ok, { ok: true, settings: { enabled: true, weekday: 5, hour: 18, onlyOnIssues: true, savedAt: now.toISOString() } });
  assert.equal(parseReportSettingsForm({ enabled: true, weekday: "7", hour: "1", onlyOnIssues: false }, now).ok, false);
  assert.equal(parseReportSettingsForm({ enabled: true, weekday: "1", hour: "24", onlyOnIssues: false }, now).ok, false);
});

test("reportText: зөрчил, хүрэхгүй, хуучин хувилбар ялгагдана; дүн нууц биш", () => {
  const r = buildReport(
    [
      target(),
      target({ name: "SmartGPS", ontology: { enforce: [], unknown: [], violations: null } }),
      target({ name: "A", ontology: { enforce: ["gl"], unknown: [], violations: { last7d: 2, byObject: { journal_vouchers: 2 }, total: 2, lastAt: null } } }),
    ],
    "schedule",
    new Date()
  );
  const text = reportText(r, "https://console.example");
  assert.match(text, /долоо хоногийн тайлан/);
  assert.match(text, /🟢 Entry SaaS v1\.9\.0 — 7 хоногт 0 зөрчил/);
  assert.match(text, /⚪ SmartGPS .*зөрчлийн тоо өгдөггүй/);
  assert.match(text, /🟠 A .*2 зөрчил \(journal_vouchers 2\) · мөрдөх: gl/);
  assert.match(text, /https:\/\/console\.example\/ontology$/);
});
