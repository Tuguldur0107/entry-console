// Sync ба workflow тэнцүүлэлт НЭГ ref ашиглана — 2026-10-02 SmartGPS v1.7.0 sync-ийн
// «workflows permission» алдааг (тэнцүүлэлт main-аас, sync tag-аас) давтахгүй.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveSyncRef } from "../lib/sync-ref";

test("resolveSyncRef: ил ref → сүүлийн release → main", () => {
  assert.equal(resolveSyncRef("v1.7.0", "v1.8.0"), "v1.7.0");
  assert.equal(resolveSyncRef("  e0ce24b  ", "v1.8.0"), "e0ce24b");
  assert.equal(resolveSyncRef("", "v1.8.0"), "v1.8.0");
  assert.equal(resolveSyncRef(undefined, null), "main");
  assert.equal(resolveSyncRef("   ", ""), "main");
});

test("sync dispatch бүр тэнцүүлэлтэд ЯГ ТЭР ref-ийг дамжуулна (статик)", () => {
  // Sync эхлүүлдэг газар бүр: bootstrapSyncWorkflow(x, <ref>) → dispatch ... { ref: <ref> }
  for (const file of ["lib/actions.ts", "lib/monitor.ts", "app/api/customers/[slug]/sync/route.ts"]) {
    const src = readFileSync(file, "utf8");
    const dispatches = [...src.matchAll(/dispatchWorkflow\([^)]*"upstream-sync\.yml"[^)]*\{ ref: ([^}]+) \}\)/g)];
    assert.ok(dispatches.length > 0, `${file}: sync dispatch олдсонгүй — тест эвдэрсэн`);
    for (const [, refExpr] of dispatches) {
      const bootstrap = new RegExp(`bootstrapSyncWorkflow\\(\\w+, ${refExpr.trim().replace(/[.*+?^${}()|[\]\\!]/g, "\\$&")}\\)`);
      assert.match(src, bootstrap, `${file}: dispatch ref «${refExpr.trim()}» bootstrap-д дамжаагүй`);
    }
  }
});
