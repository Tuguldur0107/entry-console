// SaaS багцын цэвэр давхарга — шүүлт, нэгтгэл, формын шалгалт.
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSaasDeadline,
  describeSaasSeats,
  filterSaasRows,
  formatOverrides,
  parseSaasSubscriptionForm,
  summarizeSaasRows,
  type SaasSubscriptionRow,
} from "../lib/saas-subscriptions";

function row(patch: Partial<SaasSubscriptionRow> = {}): SaasSubscriptionRow {
  return {
    organizationId: "11111111-1111-1111-1111-111111111111",
    orgName: "Говь ХК",
    registryNo: "2107091",
    createdAt: "2026-09-01",
    memberCount: 2,
    ownerEmail: "bat@govi.mn",
    planId: "standard",
    status: "active",
    seats: 2,
    seatsUsed: 2,
    writable: true,
    readOnlyReason: null,
    daysLeft: null,
    trialEndsAt: null,
    currentPeriodEnd: "2026-10-01",
    overrides: null,
    note: null,
    hasRow: true,
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...patch,
  };
}

test("filterSaasRows: статус, зөвхөн унших, хайлт", () => {
  const rows = [
    row(),
    row({ organizationId: "2", orgName: "Тэнгэр ХХК", registryNo: "5500123", status: "trialing", daysLeft: 3, ownerEmail: "s@tenger.mn" }),
    row({ organizationId: "3", orgName: "Хаагдсан", registryNo: null, status: "suspended", writable: false, readOnlyReason: "Түр зогсоосон" }),
  ];
  assert.equal(filterSaasRows(rows, {}).length, 3);
  assert.deepEqual(filterSaasRows(rows, { status: "trialing" }).map((r) => r.organizationId), ["2"]);
  assert.deepEqual(filterSaasRows(rows, { status: "readonly" }).map((r) => r.organizationId), ["3"]);
  assert.deepEqual(filterSaasRows(rows, { q: "tenger" }).map((r) => r.organizationId), ["2"]);
  assert.deepEqual(filterSaasRows(rows, { q: "2107" }).map((r) => r.organizationId), ["11111111-1111-1111-1111-111111111111"]);
  assert.equal(filterSaasRows(rows, { status: "active", q: "тэнгэр" }).length, 0);
});

test("summarizeSaasRows: тоолуурууд", () => {
  const rows = [
    row(),
    row({ status: "trialing", daysLeft: 3 }),
    row({ status: "past_due", daysLeft: 10 }),
    row({ status: "suspended", writable: false, readOnlyReason: "x" }),
    row({ status: "cancelled", writable: false, readOnlyReason: "x" }),
    row({ seats: 1, seatsUsed: 3 }),
  ];
  const s = summarizeSaasRows(rows);
  assert.equal(s.total, 6);
  assert.equal(s.active, 2);
  assert.equal(s.trialing, 1);
  assert.equal(s.pastDue, 1);
  assert.equal(s.suspended, 1);
  assert.equal(s.cancelled, 1);
  assert.equal(s.readOnly, 2);
  assert.equal(s.endingSoon, 1); // trial 3 хоног; grace 10 нь 7-оос дээш
  assert.equal(s.overSeats, 1);
});

test("describeSaasDeadline / describeSaasSeats", () => {
  assert.deepEqual(describeSaasDeadline(row({ writable: false, readOnlyReason: "Trial дууссан" })), { text: "Trial дууссан", tone: "danger" });
  assert.deepEqual(describeSaasDeadline(row()), { text: "—", tone: "" });
  assert.deepEqual(describeSaasDeadline(row({ status: "trialing", daysLeft: 0 })), { text: "Өнөөдөр дуусна", tone: "danger" });
  assert.deepEqual(describeSaasDeadline(row({ status: "trialing", daysLeft: 5 })), { text: "5 хоног (trial)", tone: "warning" });
  assert.deepEqual(describeSaasDeadline(row({ status: "past_due", daysLeft: 12 })), { text: "12 хоног (grace)", tone: "" });
  assert.deepEqual(describeSaasSeats(row({ seats: null, seatsUsed: 1 })), { text: "1 / default", over: false });
  assert.deepEqual(describeSaasSeats(row({ seats: 1, seatsUsed: 2 })), { text: "2 / 1", over: true });
});

test("parseSaasSubscriptionForm: зөв оролт", () => {
  const parsed = parseSaasSubscriptionForm({
    organization_id: "org-1",
    plan_id: "platform",
    status: "active",
    seats: " 5 ",
    trial_ends_at: "",
    current_period_end: "2026-12-31",
    overrides: '{"features":{"api.rest":true}}',
    note: "  гэрээ 12 ",
  });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.input, {
    organizationId: "org-1",
    planId: "platform",
    status: "active",
    seats: 5,
    trialEndsAt: null,
    currentPeriodEnd: "2026-12-31",
    overrides: { features: { "api.rest": true } },
    note: "гэрээ 12",
  });
});

test("parseSaasSubscriptionForm: алдаанууд", () => {
  const base = { organization_id: "org-1", plan_id: "standard", status: "active" };
  const err = (fields: Record<string, string>) => {
    const parsed = parseSaasSubscriptionForm(fields);
    assert.ok(!parsed.ok);
    return parsed.error;
  };
  assert.match(err({ ...base, organization_id: "" }), /ID хоосон/);
  assert.match(err({ ...base, plan_id: "dedicated" }), /Багц буруу/);
  assert.match(err({ ...base, plan_id: "gold" }), /Багц буруу/);
  assert.match(err({ ...base, status: "paused" }), /Статус буруу/);
  assert.match(err({ ...base, seats: "0" }), /Суудал/);
  assert.match(err({ ...base, seats: "2.5" }), /Суудал/);
  assert.match(err({ ...base, current_period_end: "31.12.2026" }), /YYYY-MM-DD/);
  assert.match(err({ ...base, trial_ends_at: "2026-13-45" }), /YYYY-MM-DD/);
  assert.match(err({ ...base, status: "trialing" }), /trial дуусах огноо/);
  assert.match(err({ ...base, overrides: "{oops" }), /JSON/);
  assert.match(err({ ...base, overrides: "[1]" }), /объект/);
  assert.match(err({ ...base, overrides: '{"seats":5}' }), /features \/ limits/);
});

test("parseSaasSubscriptionForm: хоосон overrides → null", () => {
  const parsed = parseSaasSubscriptionForm({ organization_id: "o", plan_id: "trial", status: "trialing", trial_ends_at: "2026-10-01", overrides: "{}" });
  assert.ok(parsed.ok);
  assert.equal(parsed.input.overrides, null);
  assert.equal(parsed.input.seats, null);
});

test("formatOverrides", () => {
  assert.equal(formatOverrides(null), "");
  assert.equal(formatOverrides({}), "");
  assert.equal(formatOverrides({ limits: { seats: 3 } }), '{\n  "limits": {\n    "seats": 3\n  }\n}');
});
