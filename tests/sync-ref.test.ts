// Sync ба workflow тэнцүүлэлт НЭГ ref ашиглана — 2026-10-02 SmartGPS v1.7.0 sync-ийн
// «workflows permission» алдааг (тэнцүүлэлт main-аас, sync tag-аас) давтахгүй.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isVersionBehind, resolveSyncRef } from "../lib/sync-ref";

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

test("isVersionBehind: semver-оор — урагшилсан fork хоцорсонд тооцогдохгүй", () => {
  assert.equal(isVersionBehind("1.6.0", "v1.7.0"), true);
  assert.equal(isVersionBehind("v1.7.0", "v1.7.0"), false);
  // SmartGPS 2026-10-02: SHA-аар 1.7.0, сүүлийн tag v1.6.0 → авто sync ЭХЛЭХГҮЙ
  assert.equal(isVersionBehind("1.7.0", "v1.6.0"), false);
  assert.equal(isVersionBehind("1.9.0", "v1.10.0"), true);
  assert.equal(isVersionBehind(null, "v1.6.0"), null);
  assert.equal(isVersionBehind("1.6.0", undefined), null);
  // semver биш → тэгш бус (хуучин зан төлөв)
  assert.equal(isVersionBehind("dev", "v1.6.0"), true);
});

test("bootstrapSyncWorkflow: fork ref-ийг агуулж байвал workflow бичихгүй (статик)", () => {
  const src = readFileSync("lib/upstream-access.ts", "utf8");
  const body = src.slice(src.indexOf("export async function bootstrapSyncWorkflow"));
  const guard = body.indexOf("repoContainsCommit(");
  const write = body.indexOf("putFile(");
  assert.ok(guard > 0, "repoContainsCommit шалгалт алга");
  assert.ok(guard < write, "шалгалт putFile-аас ӨМНӨ байх ёстой");
});
