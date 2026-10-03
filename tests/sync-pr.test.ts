// Sync PR-ын үр дүнг ЗӨВ ажиллагаанаас уншина — 2026-10-03 SmartGPS v1.8.0:
// салбар ажиллагааны дунд push хийгдсэн тул monitor PR-ыг шалгалт дуусахаас
// өмнө нээж, өмнөх (өөр ref-ийн) ажиллагааны үр дүнг уншаад «unknown» тавьсан.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { logMentionsBranch, parseResultFromLog } from "../lib/sync-pr";

// Бодит логийн хэлбэр (Entry-mn/entry-smartgps run 37125044016, «Дүгнэлт» алхам)
const LOG = [
  '2026-10-03T13:10:48.5920012Z \x1b[36;1m  echo "- Салбар: \\`upstream-sync/v1.8.0\\`"\x1b[0m',
  '2026-10-03T13:10:48.5923461Z \x1b[36;1mecho "Үр дүн: $RESULT"\x1b[0m',
  "2026-10-03T13:10:48.6091477Z Үр дүн: passed",
].join("\n");

test("logMentionsBranch: тухайн салбарын ажиллагааг танина", () => {
  assert.equal(logMentionsBranch(LOG, "upstream-sync/v1.8.0"), true);
  assert.equal(parseResultFromLog(LOG), "passed");
});

test("logMentionsBranch: өөр ref, угтвар давхцал андуурагдахгүй", () => {
  assert.equal(logMentionsBranch(LOG, "upstream-sync/v1.7.0"), false);
  assert.equal(logMentionsBranch(LOG, "upstream-sync/v1.8"), false);
  assert.equal(logMentionsBranch("", "upstream-sync/v1.8.0"), false);
  // `.` нь regex-ийн дурын тэмдэгт БИШ
  assert.equal(logMentionsBranch(LOG.replace("v1.8.0", "v1x8x0"), "upstream-sync/v1.8.0"), false);
});

test("openSyncPulls: шалгалт дуусаагүй (pending) бол PR нээхгүй, салбараар нь үр дүн авна (статик)", () => {
  const src = readFileSync("lib/sync-pr.ts", "utf8");
  const body = src.slice(src.indexOf("export async function openSyncPulls"));
  const pending = body.indexOf('result === "pending") continue');
  const create = body.indexOf("createPull(");
  assert.ok(pending > 0 && pending < create, "pending шалгалт createPull-аас ӨМНӨ байх ёстой");
  assert.match(body, /latestSyncResult\(customer\.githubRepo, branch\.name\)/);
  assert.match(body, /latestSyncResult\(customer\.githubRepo, p\.headRef\)/);
  assert.match(src, /result === "unknown" \|\| result === "pending"\) return false/);
});
