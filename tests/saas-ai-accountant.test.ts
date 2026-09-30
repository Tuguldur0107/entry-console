// «AI нягтлан» захиалагчдын цэвэр давхарга — шүүлт, KPI, холболт.
import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_ACCOUNTANT_FILTERS,
  AI_ACCOUNTANT_KINDS,
  aiAccountantKind,
  describeConnection,
  knowledgeIncluded,
  filterAiAccountantRows,
  isConnected,
  summarizeAiAccountant,
} from "../lib/saas-ai-accountant";
import type { SaasSubscriptionRow } from "../lib/saas-subscriptions";

function row(patch: Partial<SaasSubscriptionRow> = {}): SaasSubscriptionRow {
  return {
    organizationId: "org-" + Math.random().toString(16).slice(2),
    orgName: "Бат-Эрдэнэ",
    registryNo: null,
    createdAt: "2026-09-20",
    memberCount: 1,
    ownerEmail: "bat@example.mn",
    planId: "skills",
    status: "active",
    seats: 1,
    seatsUsed: 1,
    pricePerSeatMnt: 29_000,
    pricePerSeatOverrideMnt: null,
    monthlyAmountMnt: 29_000,
    writable: true,
    readOnlyReason: null,
    daysLeft: 20,
    trialEndsAt: null,
    currentPeriodEnd: "2026-10-20",
    overrides: null,
    note: null,
    hasRow: true,
    updatedAt: null,
    knowledgeReads30d: 5,
    lastKnowledgeReadAt: "2026-09-24T03:00:00.000Z",
    oauthConnections: 1,
    lastConnectorUseAt: "2026-09-24T03:00:00.000Z",
    ...patch,
  };
}

const ROWS: SaasSubscriptionRow[] = [
  row({ organizationId: "paid" }),
  row({ organizationId: "trial", status: "trialing", daysLeft: 0, monthlyAmountMnt: 0, oauthConnections: 0, knowledgeReads30d: 0 }),
  row({ organizationId: "grace", status: "past_due", daysLeft: 2 }),
  row({ organizationId: "closed", status: "past_due", writable: false, readOnlyReason: "Захиалга дууссан", oauthConnections: 0, monthlyAmountMnt: 29_000 }),
  row({ organizationId: "unknown-price", monthlyAmountMnt: null }),
  // Entry-ийн байгууллага — мэдлэгийн сан үнэгүй багтсан, ChatGPT / Claude холбосон → «Үнэгүй» (2026-09-30)
  row({ organizationId: "entry-org", planId: "standard", orgName: "Говь ХК", ownerEmail: "gobi@example.mn", monthlyAmountMnt: 200_000 }),
  // Entry-ийн байгууллага — холбоогүй, уншаагүй → энд ГАРАХГҮЙ («SaaS байгууллагууд»-д л)
  row({
    organizationId: "entry-unused",
    planId: "platform",
    ownerEmail: "idle@example.mn",
    oauthConnections: 0,
    knowledgeReads30d: 0,
    lastKnowledgeReadAt: null,
    lastConnectorUseAt: null,
  }),
  // Entry-ийн байгууллага — уншсан ч Console-оор мэдлэгийн санг унтраасан → гарахгүй
  row({ organizationId: "entry-off", planId: "standard", ownerEmail: "off@example.mn", overrides: { features: { knowledge: false } } }),
  // Entry-ийн туршилт, PAT-аар уншсан (OAuth-гүй), 30 хоногт уншаагүй → «Үнэгүй», идэвхгүй
  row({ organizationId: "entry-trial", planId: "trial", status: "trialing", ownerEmail: "new@example.mn", oauthConnections: 0, knowledgeReads30d: 0 }),
];

test("summarizeAiAccountant — төлбөртэйн KPI зөвхөн skills-ээс; үнэгүйг тусад нь тоолно", () => {
  const s = summarizeAiAccountant(ROWS);
  assert.equal(s.total, 7, "5 төлбөртэй + 2 үнэгүй (ашиглаагүй, унтраасан нь орохгүй)");
  assert.equal(s.paidTotal, 5);
  assert.equal(s.freeTotal, 2);
  assert.equal(s.freeActive30d, 1, "entry-trial 30 хоногт уншаагүй");
  assert.equal(s.trialing, 1);
  assert.equal(s.paid, 2);
  assert.equal(s.pastDue, 2);
  assert.equal(s.readOnly, 1);
  // идэвхтэй ч холбоогүй = trial л (хаалттай нь тоологдохгүй — сунгах хүртэл холбох утгагүй);
  // үнэгүйн entry-trial (OAuth-гүй) төлбөртэйн онбордингийн KPI-д орохгүй
  assert.equal(s.unconnected, 1);
  assert.equal(s.activeUsers30d, 5, "4 төлбөртэй + entry-org");
  // MRR = active + past_due (paid 29,000 + grace 29,000 + closed 29,000); unknown-price нь ил тоологдоно;
  // Entry-ийн багцын 200,000₮ энд ОРОХГҮЙ (AI нягтлангийн орлого биш)
  assert.equal(s.mrrMnt, 87_000);
  assert.equal(s.mrrUnknown, 1);
});

test("summarizeAiAccountant — хоосон", () => {
  const s = summarizeAiAccountant([]);
  assert.equal(s.total, 0);
  assert.equal(s.mrrMnt, 0);
});

test("filterAiAccountantRows — төрөл, статус, хаалттай, холбоогүй, хайлт", () => {
  const ids = (filter: { status?: string; q?: string; kind?: string }) =>
    filterAiAccountantRows(ROWS, filter).map((r) => r.organizationId);
  assert.deepEqual(ids({}), ["paid", "trial", "grace", "closed", "unknown-price", "entry-org", "entry-trial"]);
  assert.deepEqual(ids({ kind: "paid" }), ["paid", "trial", "grace", "closed", "unknown-price"]);
  assert.deepEqual(ids({ kind: "free" }), ["entry-org", "entry-trial"]);
  assert.deepEqual(ids({ kind: "paid", status: "trialing" }), ["trial"]);
  assert.deepEqual(ids({ kind: "paid", status: "active" }), ["paid", "unknown-price"]);
  assert.deepEqual(ids({ status: "past_due" }), ["grace", "closed"]);
  assert.deepEqual(ids({ status: "readonly" }), ["closed"]);
  assert.deepEqual(ids({ kind: "paid", status: "unconnected" }), ["trial", "closed"]);
  assert.deepEqual(ids({ q: "gobi" }), ["entry-org"], "үнэгүй ашиглагч и-мэйлээр олдоно");
  assert.deepEqual(ids({ q: "idle" }), [], "ашиглаагүй Entry байгууллага олдохгүй");
  assert.deepEqual(ids({ q: "off@" }), [], "мэдлэгийн санг унтраасан байгууллага олдохгүй");
  assert.deepEqual(ids({ kind: "paid", q: "BAT@" }).length, 5, "и-мэйл том/жижиг үсэг хамаарахгүй");
  assert.deepEqual(ids({ status: "active", q: "unknown" }), ["unknown-price"]);
});

test("aiAccountantKind / knowledgeIncluded — багц, override, ашиглалт", () => {
  assert.equal(aiAccountantKind(row({ planId: "skills", oauthConnections: 0, knowledgeReads30d: 0, lastKnowledgeReadAt: null })), "paid", "төлбөртэй нь ашиглаагүй ч харагдана");
  assert.equal(aiAccountantKind(row({ planId: "enterprise" })), "free");
  assert.equal(aiAccountantKind(row({ planId: "standard", oauthConnections: 1, knowledgeReads30d: 0, lastKnowledgeReadAt: null })), "free", "холбосон л бол");
  assert.equal(aiAccountantKind(row({ planId: "standard", oauthConnections: 0, knowledgeReads30d: 0, lastKnowledgeReadAt: null })), null);
  assert.equal(aiAccountantKind(row({ planId: "dedicated" })), null, "dedicated-д мэдлэгийн сан байхгүй");
  assert.equal(knowledgeIncluded(row({ planId: "dedicated", overrides: { features: { knowledge: true } } })), true, "override давамгайлна");
  assert.equal(knowledgeIncluded(row({ planId: "standard", overrides: { features: { knowledge: false } } })), false);
  assert.equal(knowledgeIncluded(row({ planId: "standard", overrides: "гажиг" })), true, "гажиг override → багцын default");
  for (const option of AI_ACCOUNTANT_KINDS) {
    assert.doesNotThrow(() => filterAiAccountantRows(ROWS, { kind: option.value }));
  }
  assert.equal(AI_ACCOUNTANT_KINDS[0].value, "", "эхнийх нь «Бүгд»");
});

test("Шүүлтүүрийн chip бүр filterAiAccountantRows-д танигдана", () => {
  for (const filter of AI_ACCOUNTANT_FILTERS) {
    assert.doesNotThrow(() => filterAiAccountantRows(ROWS, { status: filter.value }));
  }
  assert.equal(AI_ACCOUNTANT_FILTERS[0].value, "", "эхнийх нь «Бүгд»");
});

test("isConnected / describeConnection — хуучин core (талбар 0) ба хаалттай захиалагч", () => {
  assert.equal(isConnected(row({ oauthConnections: 2 })), true);
  assert.equal(isConnected(row({ oauthConnections: 0 })), false);
  assert.deepEqual(describeConnection(row({ oauthConnections: 2 })), { text: "2 холболт", tone: "" });
  assert.deepEqual(describeConnection(row({ oauthConnections: 0 })), { text: "холбоогүй", tone: "warning" });
  // Хаалттай (сунгаагүй) захиалагчид «холбоогүй» гэж анхааруулахгүй — эхлээд төлөх ёстой
  assert.deepEqual(describeConnection(row({ oauthConnections: 0, writable: false })), { text: "—", tone: "" });
});
