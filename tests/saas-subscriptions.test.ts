// SaaS багцын цэвэр давхарга — шүүлт, нэгтгэл, формын шалгалт.
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PLAN_PRICE_MNT,
  describeSaasDeadline,
  describeSaasSeats,
  filterSaasRows,
  formatOverrides,
  currentPeriod,
  groupPeriodsByPlan,
  isIsoDate,
  parsePlanPricePeriodForm,
  periodStatus,
  byOrgName,
  rowsWithSpecialPrice,
  parsePriceField,
  parseSaasSubscriptionForm,
  summarizeRevenue,
  summarizeSaasRows,
  withSeatPrice,
  type SaasPlanPricePeriod,
  type SaasSubscriptionRow,
  SAAS_ASSIGNABLE_PLANS,
  SAAS_STATUSES,
  SUBSCRIPTION_PRESETS,
  presetOverridesJson,
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
    pricePerSeatMnt: 100_000,
    pricePerSeatOverrideMnt: null,
    monthlyAmountMnt: 200_000,
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
  assert.deepEqual(describeSaasSeats(row({ seats: null, seatsUsed: 1 })), { text: "1 / багцаар", over: false });
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
    pricePerSeatMnt: null,
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

test("parsePriceField: хоосон → null, форматтай текст → тоо", () => {
  assert.deepEqual(parsePriceField("", "Үнэ"), { ok: true, value: null });
  assert.deepEqual(parsePriceField("  ", "Үнэ"), { ok: true, value: null });
  assert.deepEqual(parsePriceField("0", "Үнэ"), { ok: true, value: 0 });
  assert.deepEqual(parsePriceField(" 149,000 ₮ ", "Үнэ"), { ok: true, value: 149_000 });
});

test("parsePriceField: гажиг оролт алдаа буцаана", () => {
  for (const bad of ["-1", "100.5", "үнэгүй", String(MAX_PLAN_PRICE_MNT + 1)]) {
    const parsed = parsePriceField(bad, "Үнэ");
    assert.ok(!parsed.ok, `${bad} нь алдаа өгөх ёстой`);
    assert.match(parsed.error, /Үнэ/);
  }
});

function pricePeriod(patch: Partial<SaasPlanPricePeriod> & { id: string }): SaasPlanPricePeriod {
  return {
    planId: "standard",
    pricePerSeatMnt: 100_000,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    note: null,
    ...patch,
  };
}

test("isIsoDate: бодит огноог л зөвшөөрнө", () => {
  assert.ok(isIsoDate("2026-02-28"));
  assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("2026-1-1"));
});

test("parsePlanPricePeriodForm: бүрэн оролт", () => {
  const parsed = parsePlanPricePeriodForm({
    plan_id: "standard",
    price: " 149,000 ₮ ",
    effective_from: "2026-07-01",
    effective_to: "2026-12-31",
    note: "  хагас жилийн тариф ",
  });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.input, {
    planId: "standard",
    pricePerSeatMnt: 149_000,
    effectiveFrom: "2026-07-01",
    effectiveTo: "2026-12-31",
    note: "хагас жилийн тариф",
  });
});

test("parsePlanPricePeriodForm: хоосон дуусах = хугацаагүй, хоосон үнэ = хэлэлцээрээр", () => {
  const parsed = parsePlanPricePeriodForm({ plan_id: "enterprise", price: "", effective_from: "2026-01-01" });
  assert.ok(parsed.ok);
  assert.equal(parsed.input.effectiveTo, null);
  assert.equal(parsed.input.pricePerSeatMnt, null);
  assert.equal(parsed.input.note, null);
});

test("parsePlanPricePeriodForm: алдаанууд", () => {
  const err = (fields: Record<string, string>) => {
    const parsed = parsePlanPricePeriodForm(fields);
    assert.ok(!parsed.ok);
    return parsed.error;
  };
  const base = { plan_id: "standard", price: "100000", effective_from: "2026-01-01" };
  assert.match(err({ ...base, plan_id: "gold" }), /Багц буруу/);
  assert.match(err({ ...base, price: "-5" }), /Үнэ/);
  assert.match(err({ ...base, effective_from: "" }), /Эхлэх огноо/);
  assert.match(err({ ...base, effective_from: "2026-02-30" }), /Эхлэх огноо/);
  assert.match(err({ ...base, effective_to: "тодорхойгүй" }), /Дуусах огноо/);
  assert.match(err({ ...base, effective_from: "2026-07-01", effective_to: "2026-06-30" }), /өмнө байна/);
});

test("currentPeriod: хил ХАМРУУЛСАН, хамрахгүй бол null", () => {
  const periods = [
    pricePeriod({ id: "a", pricePerSeatMnt: 80_000, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" }),
    pricePeriod({ id: "b", pricePerSeatMnt: 120_000, effectiveFrom: "2026-07-01" }),
  ];
  assert.equal(currentPeriod(periods, "standard", "2026-06-30")?.id, "a");
  assert.equal(currentPeriod(periods, "standard", "2026-07-01")?.id, "b");
  assert.equal(currentPeriod(periods, "standard", "2025-12-31"), null);
  assert.equal(currentPeriod(periods, "platform", "2026-07-01"), null);
});

test("periodStatus: ирээдүй / мөрдөж буй / дууссан", () => {
  const today = "2026-07-15";
  assert.equal(periodStatus(pricePeriod({ id: "a", effectiveFrom: "2027-01-01" }), today).label, "Ирээдүйд");
  assert.equal(periodStatus(pricePeriod({ id: "b", effectiveFrom: "2026-01-01" }), today).label, "Мөрдөж буй");
  assert.equal(
    periodStatus(pricePeriod({ id: "c", effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" }), today).label,
    "Дууссан"
  );
});

test("groupPeriodsByPlan: багцаар бүлэглэж огноогоор эрэмбэлнэ, хоосон багц ОРОХГҮЙ", () => {
  const groups = groupPeriodsByPlan([
    pricePeriod({ id: "b", effectiveFrom: "2026-07-01" }),
    pricePeriod({ id: "a", effectiveFrom: "2026-01-01" }),
    pricePeriod({ id: "p", planId: "platform", effectiveFrom: "2026-01-01" }),
  ]);
  assert.deepEqual(groups.map((g) => g.planId), ["standard", "platform"]);
  assert.deepEqual(groups[0].periods.map((p) => p.id), ["a", "b"]);
});

test("parseSaasSubscriptionForm: тусгай үнэ", () => {
  const base = { organization_id: "o", plan_id: "standard", status: "active" };
  const withPrice = parseSaasSubscriptionForm({ ...base, price_per_seat: "80,000" });
  assert.ok(withPrice.ok);
  assert.equal(withPrice.input.pricePerSeatMnt, 80_000);
  const empty = parseSaasSubscriptionForm(base);
  assert.ok(empty.ok);
  assert.equal(empty.input.pricePerSeatMnt, null);
  const bad = parseSaasSubscriptionForm({ ...base, price_per_seat: "үнэгүй" });
  assert.ok(!bad.ok);
  assert.match(bad.error, /Тусгай үнэ/);
});

test("summarizeRevenue: зөвхөн идэвхтэй/хоцорсон, дүн зохиохгүй", () => {
  const revenue = summarizeRevenue([
    row({ status: "active", monthlyAmountMnt: 200_000 }),
    row({ organizationId: "2", status: "past_due", monthlyAmountMnt: 100_000 }),
    row({ organizationId: "3", status: "active", monthlyAmountMnt: null }),
    row({ organizationId: "4", status: "trialing", monthlyAmountMnt: 999_999 }),
    row({ organizationId: "5", status: "cancelled", monthlyAmountMnt: 500_000 }),
  ]);
  assert.deepEqual(revenue, { mrrMnt: 300_000, billable: 2, unknown: 1 });
  assert.deepEqual(summarizeRevenue([]), { mrrMnt: 0, billable: 0, unknown: 0 });
});

test("rowsWithSpecialPrice: зөвхөн тусгай үнэтэй, нэрээр эрэмбэлнэ", () => {
  const rows = [
    row({ organizationId: "1", orgName: "Ямаа ХХК", pricePerSeatOverrideMnt: 80_000 }),
    row({ organizationId: "2", orgName: "Адуу ХХК", pricePerSeatOverrideMnt: null }),
    row({ organizationId: "3", orgName: "Бух ХХК", pricePerSeatOverrideMnt: 0 }),
  ];
  const special = rowsWithSpecialPrice(rows);
  assert.deepEqual(special.map((r) => r.orgName), ["Бух ХХК", "Ямаа ХХК"]);
});

test("withSeatPrice: зөвхөн үнэ солигдож, бусад талбар ХЭВЭЭР", () => {
  const source = row({
    organizationId: "org-9",
    planId: "platform",
    status: "past_due",
    seats: 7,
    pricePerSeatOverrideMnt: null,
    trialEndsAt: "2026-05-01",
    currentPeriodEnd: "2026-11-30",
    overrides: { limits: { companies: 3 } },
    note: "гэрээ 42",
  });
  assert.deepEqual(withSeatPrice(source, 55_000), {
    organizationId: "org-9",
    planId: "platform",
    status: "past_due",
    seats: 7,
    pricePerSeatMnt: 55_000,
    trialEndsAt: "2026-05-01",
    currentPeriodEnd: "2026-11-30",
    overrides: { limits: { companies: 3 } },
    note: "гэрээ 42",
  });
  // Цэвэрлэхэд ч бусад талбар хөндөгдөхгүй
  assert.equal(withSeatPrice(source, null).pricePerSeatMnt, null);
  assert.equal(withSeatPrice(source, null).note, "гэрээ 42");
});

test("byOrgName: локалаас ХАМААРАХГҮЙ тогтвортой эрэмбэ", () => {
  const names = ["Ямаа", "Адуу", "Бух", "Адуу"].map((orgName) => ({ orgName }));
  assert.deepEqual([...names].sort(byOrgName).map((n) => n.orgName), ["Адуу", "Адуу", "Бух", "Ямаа"]);
  assert.equal(byOrgName({ orgName: "А" }, { orgName: "А" }), 0);
});

// ── Бэлэн тохиргоо (preset) — «нягтлан бодогч, олон компани» ───────────────

test("нягтлан бодогчийн preset нь ОЛОН компани нээнэ", () => {
  const preset = SUBSCRIPTION_PRESETS.find((p) => p.key === "accountant-10");
  assert.ok(preset, "accountant-10 preset байх ёстой");
  // platform багц нь multi_company боломжтой цорын ганц оноодог багц —
  // standard дээр 2 дахь компани огт үүсэхгүй.
  assert.equal(preset.planId, "platform");
  assert.equal(preset.status, "active");
  assert.equal(preset.companies, 10);
  assert.deepEqual(JSON.parse(presetOverridesJson(preset)), {
    limits: { companies: 10 },
  });
});

test("preset бүр хүчинтэй багц + статустай", () => {
  for (const preset of SUBSCRIPTION_PRESETS) {
    assert.ok(
      SAAS_ASSIGNABLE_PLANS.includes(preset.planId),
      `${preset.key}: багц оноогдохгүй байна`
    );
    assert.ok(SAAS_STATUSES.includes(preset.status), `${preset.key}: статус буруу`);
    assert.ok(preset.seats >= 1, `${preset.key}: суудал 1-ээс доошгүй`);
    assert.match(preset.currentPeriodEnd, /^\d{4}-\d{2}-\d{2}$/, `${preset.key}: огноо`);
  }
});

test("нэг компанийн preset нь companies override ТАВИХГҮЙ", () => {
  // Standard багц өөрөө 1 компанитай — override бичвэл утгагүй давхардал.
  const preset = SUBSCRIPTION_PRESETS.find((p) => p.key === "single");
  assert.ok(preset);
  assert.equal(preset.companies, null);
  assert.equal(presetOverridesJson(preset), "");
});

test("preset-ийн түлхүүр давхардахгүй", () => {
  const keys = SUBSCRIPTION_PRESETS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
});
