// Sync push түлхүүрийн өөрөө засагдах дүрэм — хуучин харилцагч түлхүүргүй
// үлдэж sync чимээгүй унадаг байсныг (2026-09-21) давтахгүй байхыг батална.
import assert from "node:assert/strict";
import test from "node:test";

import { computeAttention, type CustomerSummary } from "../lib/customers";
import type { Customer } from "../lib/db/schema";
import { needsPushKey, PUSH_KEY_RETRY_MS, pushKeyFailureText, pushKeyRetryDue } from "../lib/push-key";

test("push түлхүүр хэрэгтэй: идэвхтэй + эрхтэй + түлхүүргүй", () => {
  assert.equal(needsPushKey({ status: "active", upstreamAccess: true, syncPushKeyId: null }), true);
  assert.equal(needsPushKey({ status: "active", upstreamAccess: true, syncPushKeyId: 42 }), false);
  // Эрх цуцлагдсан / идэвхгүй харилцагчид түлхүүр ҮҮСГЭХГҮЙ (цуцлалтыг буцаахгүй)
  assert.equal(needsPushKey({ status: "active", upstreamAccess: false, syncPushKeyId: null }), false);
  assert.equal(needsPushKey({ status: "paused", upstreamAccess: true, syncPushKeyId: null }), false);
  assert.equal(needsPushKey({ status: "provisioning", upstreamAccess: true, syncPushKeyId: null }), false);
});

test("дахин оролдлого: анх шууд, амжилтгүйн дараа 6 цаг хүлээнэ", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  assert.equal(pushKeyRetryDue(null, now), true);
  assert.equal(pushKeyRetryDue(new Date(now.getTime() - 60_000), now), false);
  assert.equal(pushKeyRetryDue(new Date(now.getTime() - PUSH_KEY_RETRY_MS), now), true);
});

test("org дээр deploy key хориотой бол засах заавар текстэд орно", () => {
  const text = pushKeyFailureText("Deploy keys are disabled for this repository", "Entry-mn");
  assert.match(text, /Organization Settings → Repository → Deploy keys/);
  assert.match(text, /«Entry-mn»/);
  assert.doesNotMatch(pushKeyFailureText("Bad credentials", "Entry-mn"), /Organization Settings/);
});

function summary(patch: Partial<Customer>): CustomerSummary {
  return {
    customer: {
      id: "c1",
      slug: "demo",
      displayName: "Demo компани",
      status: "active",
      githubRepo: "Entry-mn/entry-demo",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      autoSync: true,
      upstreamAccess: true,
      syncPushKeyId: 7,
      syncNote: null,
      healthOk: true,
      ...patch,
    } as unknown as Customer,
    repo: { fullName: "Entry-mn/entry-demo", pushedAt: "2026-09-18T00:00:00Z" } as CustomerSummary["repo"],
    health: { ok: true, version: "1.5.2" } as CustomerSummary["health"],
    lastSync: null,
    behind: false,
  };
}

test("самбар: push түлхүүргүй бол хоцроогүй байсан ч анхааруулна", () => {
  const pushWarning = (items: CustomerSummary[]) =>
    computeAttention(items, null).filter((i) => i.detail.startsWith("Sync push түлхүүр алга"));
  assert.equal(pushWarning([summary({ syncPushKeyId: null })]).length, 1);
  assert.equal(pushWarning([summary({ syncPushKeyId: 7 })]).length, 0);
  // Эрх цуцлагдсан харилцагчид энэ анхааруулга хамаарахгүй
  assert.equal(pushWarning([summary({ syncPushKeyId: null, upstreamAccess: false })]).length, 0);
});
