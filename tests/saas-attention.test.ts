import assert from "node:assert/strict";
import test from "node:test";

import { computeSaasAttention } from "../lib/saas-attention";
import type { SaasSubscriptionRow } from "../lib/saas-subscriptions";

function row(patch: Partial<SaasSubscriptionRow> = {}): SaasSubscriptionRow {
  return {
    organizationId: "org-1",
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
    currentPeriodEnd: null,
    overrides: null,
    note: null,
    hasRow: true,
    updatedAt: null,
    knowledgeReads30d: 0,
    lastKnowledgeReadAt: null,
    oauthConnections: 0,
    lastConnectorUseAt: null,
    ...patch,
  };
}

test("computeSaasAttention: хэвийн байгууллагад мөр гарахгүй, цуцлагдсан алгасна", () => {
  assert.deepEqual(computeSaasAttention([row(), row({ organizationId: "c", status: "cancelled", writable: false })]), []);
});

test("computeSaasAttention: зөвхөн унших → danger, хоцорсон → warning, суудал хэтэрсэн нэмэлт мөр", () => {
  const items = computeSaasAttention([
    row({ organizationId: "ro", orgName: "Б", writable: false, readOnlyReason: "Trial дууссан" }),
    row({ organizationId: "pd", orgName: "А", status: "past_due", daysLeft: 5, seats: 1, seatsUsed: 3 }),
  ]);
  assert.deepEqual(
    items.map((item) => [item.organizationId, item.tone, item.detail]),
    [
      ["pd", "warning", "Төлбөр хоцорсон — grace 5 хоног үлдсэн"],
      ["pd", "warning", "Суудал хэтэрсэн — 3 / 1"],
      ["ro", "danger", "Бичих эрх хаагдсан — Trial дууссан"],
    ]
  );
});

test("computeSaasAttention: trial / үе ойрхон дуусах — 7 хоногт info, 1 хоногт warning", () => {
  const items = computeSaasAttention([
    row({ organizationId: "t", status: "trialing", daysLeft: 6 }),
    row({ organizationId: "t0", status: "trialing", daysLeft: 0 }),
    row({ organizationId: "p", status: "active", daysLeft: 1 }),
    row({ organizationId: "far", status: "active", daysLeft: 30 }),
  ]);
  assert.deepEqual(
    items.map((item) => [item.organizationId, item.tone]),
    [["t", "info"], ["t0", "warning"], ["p", "warning"]]
  );
  assert.match(items[0].detail, /Trial 6 хоногт дуусна/);
  assert.match(items[1].detail, /Trial өнөөдөр дуусна/);
  assert.match(items[2].detail, /Төлбөрийн үе 1 хоногт дуусна/);
});
