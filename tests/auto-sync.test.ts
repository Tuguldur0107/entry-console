// autoSyncStats — «Бүгдэд авто sync асаах» товчны тоолуур.
//
// Гол баталгаа: тоолуур нь `monitor.ts`-ийн нөхцөлтэй ЯГ таарна
// (`autoSync && status === "active" && upstreamAccess`). Зөрвөл UI «асаалттай»
// гэж хэлээд бодит sync явахгүй байх худал төлөв үүснэ.
import assert from "node:assert/strict";
import test from "node:test";

import { autoSyncStats, type AutoSyncScope } from "../lib/customers";

const c = (over: Partial<AutoSyncScope>): AutoSyncScope => ({
  slug: "x",
  status: "active",
  autoSync: true,
  upstreamAccess: true,
  ...over,
});

test("идэвхтэй + эрхтэй + асаалттай → on", () => {
  const s = autoSyncStats([c({ slug: "govi" })]);
  assert.deepEqual(s, { eligible: 1, on: 1, off: [], blocked: 0 });
});

test("идэвхтэй + эрхтэй + унтраалттай → off жагсаалтад", () => {
  const s = autoSyncStats([c({ slug: "govi", autoSync: false })]);
  assert.deepEqual(s, { eligible: 1, on: 0, off: ["govi"], blocked: 0 });
});

test("эрх цуцлагдсан нь blocked — асаах зорилтод ОРОХГҮЙ", () => {
  // Эрхгүй харилцагчид asaaсан ч monitor ажиллахгүй тул товч түүнийг барихгүй.
  const s = autoSyncStats([c({ slug: "hasah", upstreamAccess: false, autoSync: false })]);
  assert.deepEqual(s, { eligible: 0, on: 0, off: [], blocked: 1 });
});

test("идэвхгүй төлөвүүд огт тоологдохгүй", () => {
  const rows: AutoSyncScope[] = [
    c({ slug: "a", status: "pending", autoSync: false }),
    c({ slug: "b", status: "provisioning", autoSync: false }),
    c({ slug: "d", status: "suspended", autoSync: false }),
    c({ slug: "e", status: "archived", autoSync: false }),
    c({ slug: "f", status: "rejected", autoSync: false }),
  ];
  assert.deepEqual(autoSyncStats(rows), { eligible: 0, on: 0, off: [], blocked: 0 });
});

test("холимог багц — off нь slug-аар дараалж гарна", () => {
  const s = autoSyncStats([
    c({ slug: "a", autoSync: true }),
    c({ slug: "b", autoSync: false }),
    c({ slug: "c", autoSync: false }),
    c({ slug: "d", upstreamAccess: false }),
    c({ slug: "e", status: "archived", autoSync: false }),
  ]);
  assert.equal(s.eligible, 3);
  assert.equal(s.on, 1);
  assert.deepEqual(s.off, ["b", "c"]);
  assert.equal(s.blocked, 1);
});

test("хоосон багц → бүх тоолуур тэг", () => {
  assert.deepEqual(autoSyncStats([]), { eligible: 0, on: 0, off: [], blocked: 0 });
});
