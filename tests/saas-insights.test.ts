// Туршилтын funnel, AI tool-ийн хэрэглээний цэвэр туслахууд (lib/saas-insights.ts).
import assert from "node:assert/strict";
import test from "node:test";

import {
  biggestDropOff,
  errorTone,
  fmtHours,
  fmtRate,
  parseDays,
  rangeForDays,
  parseFunnelProduct,
  stageDate,
  totalWriteAcceptance,
  writeAcceptance,
  type FunnelStageStat,
  type ToolUsageSummary,
} from "../lib/saas-insights";

const stage = (key: FunnelStageStat["key"], count: number, rateFromPrevious: number | null): FunnelStageStat => ({
  key,
  label: key,
  count,
  reachedAnyOrder: count,
  rateFromSignup: null,
  rateFromPrevious,
  medianHoursFromSignup: null,
});

test("мужийн сонголт: зөвхөн 7/30/90/180, УБ-ын өдрөөр", () => {
  assert.equal(parseDays("30", 90), 30);
  assert.equal(parseDays("31", 90), 90);
  assert.equal(parseDays(undefined, 90), 90);
  // 2026-10-16 01:00 УБ = 2026-10-15 17:00 UTC — УБ-ын өдөр 16
  assert.deepEqual(rangeForDays(7, new Date("2026-10-15T17:00:00Z")), { from: "2026-10-10", to: "2026-10-16" });
});

test("хувь ба хугацааны формат — алга бол «—», тоо зохиохгүй", () => {
  assert.equal(fmtRate(null), "—");
  assert.equal(fmtRate(0), "0%");
  assert.equal(fmtRate(0.714), "71%");
  assert.equal(fmtRate(0.053), "5.3%");
  assert.equal(fmtHours(null), "—");
  assert.equal(fmtHours(0.25), "15 мин");
  assert.equal(fmtHours(24), "24 цаг");
  assert.equal(fmtHours(84), "3.5 өдөр");
  assert.equal(fmtHours(24 * 12), "12 өдөр");
});

test("хамгийн их алдагдал = өмнөхөөс хамгийн бага хувь; алдагдалгүй бол null", () => {
  const stages = [stage("signed_up", 10, 1), stage("connected", 7, 0.7), stage("master_data", 2, 0.29), stage("first_journal", 2, 1)];
  const drop = biggestDropOff(stages);
  assert.equal(drop?.from.key, "connected");
  assert.equal(drop?.to.key, "master_data");
  assert.equal(biggestDropOff([stage("signed_up", 3, 1), stage("connected", 3, 1)]), null);
  // Өмнөх алхам 0 бол хувь утгагүй — алгасна
  assert.equal(biggestDropOff([stage("signed_up", 0, null), stage("connected", 0, null)]), null);
});

test("байгууллагын мөрийн алхмын огноо", () => {
  const row = {
    organizationId: "o",
    orgName: "A",
    createdAt: "2026-10-01T00:00:00Z",
    planId: null,
    lastStage: "connected" as const,
    connectedAt: "2026-10-02T00:00:00Z",
    masterDataAt: null,
    firstJournalAt: null,
    paidAt: null,
    manuallyConverted: false,
    welcomeDismissed: false,
  };
  assert.equal(stageDate(row, "signed_up"), row.createdAt);
  assert.equal(stageDate(row, "connected"), row.connectedAt);
  assert.equal(stageDate(row, "paid"), null);
});

test("алдааны өнгө ба бичих tool-ийн хүлээн авалт", () => {
  assert.equal(errorTone(0.01), null);
  assert.equal(errorTone(0.05), "warning");
  assert.equal(errorTone(0.2), "danger");
  const writes = { suggestions: 10, accepted: 6, modified: 2, rejected: 1, noAction: 1, posted: 5, reversed: 1 };
  assert.equal(writeAcceptance(writes), 0.8);
  assert.equal(writeAcceptance(null), null);
  assert.equal(writeAcceptance({ ...writes, suggestions: 0 }), null);
  const tool = (w: ToolUsageSummary["writes"]): ToolUsageSummary => ({
    toolName: "t",
    calls: 1,
    errors: 0,
    errorRate: 0,
    organizations: 1,
    avgLatencyMs: 0,
    maxLatencyMs: 0,
    bySource: {},
    errorCodes: [],
    writes: w,
  });
  assert.deepEqual(totalWriteAcceptance([tool(writes), tool(null), tool({ ...writes, suggestions: 10, accepted: 0, modified: 0 })]), {
    suggestions: 20,
    rate: 0.4,
  });
  assert.deepEqual(totalWriteAcceptance([tool(null)]), { suggestions: 0, rate: null });
});

test("parseFunnelProduct: academy танигдана, танихгүй бол нягтлан бодох систем", () => {
  assert.equal(parseFunnelProduct("academy"), "academy");
  assert.equal(parseFunnelProduct("skills"), "skills");
  assert.equal(parseFunnelProduct("x"), "accounting");
  assert.equal(parseFunnelProduct(undefined), "accounting");
});
