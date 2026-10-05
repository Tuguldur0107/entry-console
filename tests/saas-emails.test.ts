// Харилцагчид руу и-мэйл — шүүлт, KPI, сонголт, бичих цонхны шалгалт.
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_MAX_RECIPIENTS,
  composeErrors,
  eventLabel,
  filterTrialContacts,
  previewText,
  sendableIds,
  summarizeTrialContacts,
  type SaasTrialContact,
} from "../lib/saas-emails";

const NOW = Date.parse("2026-10-05T00:00:00Z");

function contact(id: string, patch: Partial<SaasTrialContact> = {}): SaasTrialContact {
  return {
    organizationId: id,
    orgName: `Org ${id}`,
    orgCreatedAt: "2026-09-20T00:00:00Z",
    planId: "trial",
    subStatus: "trialing",
    trialEndsAt: null,
    ownerName: `Owner ${id}`,
    ownerEmail: `${id}@example.mn`,
    emailVerifiedAt: null,
    marketingOptOutAt: null,
    campaignsReceived: 0,
    delivery: { total: 0, delivered: 0, failed: 0, lastAt: null, lastEvent: null, lastSubject: null },
    ...patch,
  };
}

const rows = [
  contact("a", { emailVerifiedAt: "2026-09-21T00:00:00Z", campaignsReceived: 1, delivery: { total: 1, delivered: 1, failed: 0, lastAt: "2026-10-01T00:00:00Z", lastEvent: "delivered", lastSubject: "x" } }),
  contact("b", { trialEndsAt: "2026-10-08T00:00:00Z" }),
  contact("c", { marketingOptOutAt: "2026-10-02T00:00:00Z", subStatus: "active" }),
  contact("d", { trialEndsAt: "2026-11-30T00:00:00Z", delivery: { total: 1, delivered: 0, failed: 1, lastAt: "2026-09-23T00:00:00Z", lastEvent: "bounced", lastSubject: "y" } }),
];

const ids = (list: SaasTrialContact[]) => list.map((c) => c.organizationId);

test("filterTrialContacts: шүүлтүүр бүр", () => {
  const f = (filter: string) => ids(filterTrialContacts(rows, { filter, q: "", now: NOW }));
  assert.deepEqual(f(""), ["a", "b", "c", "d"]);
  assert.deepEqual(f("verified"), ["a"]);
  assert.deepEqual(f("unverified"), ["b", "c", "d"]);
  assert.deepEqual(f("never_emailed"), ["b", "d"]);
  assert.deepEqual(f("trialing"), ["a", "b", "d"]);
  assert.deepEqual(f("trial_ending"), ["b"]);
  assert.deepEqual(f("unsubscribed"), ["c"]);
  assert.deepEqual(f("unknown"), ["a", "b", "c", "d"]);
});

test("filterTrialContacts: и-мэйл, нэр, байгууллагаар хайна", () => {
  assert.deepEqual(ids(filterTrialContacts(rows, { filter: "", q: "B@EXAMPLE", now: NOW })), ["b"]);
  assert.deepEqual(ids(filterTrialContacts(rows, { filter: "", q: "org d", now: NOW })), ["d"]);
});

test("summarizeTrialContacts: Resend мэдэгдэхгүй бол хүрсэн/алдаатай null", () => {
  assert.deepEqual(summarizeTrialContacts(rows), { total: 4, verified: 1, unsubscribed: 1, neverEmailed: 2, reached: 1, failed: 1 });
  const unknown = summarizeTrialContacts([contact("x", { delivery: null })]);
  assert.equal(unknown.reached, null);
  assert.equal(unknown.failed, null);
});

test("sendableIds: татгалзсан хүн сонгогдсон ч илгээхгүй", () => {
  assert.deepEqual(sendableIds(rows, new Set(["a", "c", "zzz"])), ["a"]);
});

test("composeErrors: хоосон, олон мөрт гарчиг, танихгүй талбар, тоо", () => {
  assert.deepEqual(composeErrors({ subject: "Сайн уу {{name}}", body: "{{company}}", recipients: 1 }), []);
  assert.ok(composeErrors({ subject: "", body: "x", recipients: 1 }).some((e) => e.includes("Гарчиг")));
  assert.ok(composeErrors({ subject: "a\nb", body: "x", recipients: 1 }).some((e) => e.includes("нэг мөр")));
  assert.ok(composeErrors({ subject: "x", body: "{{amount}}", recipients: 1 }).some((e) => e.includes("{{amount}}")));
  assert.ok(composeErrors({ subject: "x", body: "y", recipients: 0 }).some((e) => e.includes("сонгоогүй")));
  assert.ok(composeErrors({ subject: "x", body: "y", recipients: CAMPAIGN_MAX_RECIPIENTS + 1 }).length > 0);
});

test("previewText ба eventLabel", () => {
  assert.equal(previewText("Сайн уу, {{ name }} — {{company}}", rows[0]), "Сайн уу, Owner a — Org a");
  assert.equal(previewText("{{name}}", null), "Нэр");
  assert.equal(eventLabel("delivered")?.label, "Хүрсэн");
  assert.equal(eventLabel("weird")?.label, "weird");
  assert.equal(eventLabel(null), null);
});
