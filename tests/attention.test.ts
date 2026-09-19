// computeAttention — самбарын «Анхаарах зүйлс» мөрүүд ХУУЧИРЧ үлдэхгүй байхыг батална.
import assert from "node:assert/strict";
import test from "node:test";

import { computeAttention, type CustomerSummary } from "../lib/customers";
import type { Customer } from "../lib/db/schema";
import type { Release, WorkflowRun } from "../lib/github";

const latest: Release = { tagName: "v1.4.0", htmlUrl: "", publishedAt: null } as Release;

function customer(patch: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    slug: "smartgps",
    displayName: "Смарт Жи Пи Эс ХХК",
    status: "active",
    githubRepo: "Entry-mn/entry-smartgps",
    appUrl: "https://smartgps.example",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    autoSync: true,
    upstreamAccess: true,
    syncNote: null,
    healthOk: true,
    ...patch,
  } as unknown as Customer;
}

function summary(patch: Partial<CustomerSummary> = {}): CustomerSummary {
  return {
    customer: customer(),
    repo: { fullName: "Entry-mn/entry-smartgps", pushedAt: "2026-09-18T00:00:00Z" } as CustomerSummary["repo"],
    health: { ok: true, version: "1.4.0" } as CustomerSummary["health"],
    lastSync: null,
    behind: false,
    ...patch,
  };
}

const failedRun = { status: "completed", conclusion: "failure" } as WorkflowRun;

const syncFailedText = "Сүүлийн upstream-sync амжилтгүй";
const details = (items: CustomerSummary[]) =>
  computeAttention(items, latest).map((item) => item.detail);

test("хувилбар core-той тэнцүү бол унасан sync run анхааруулга ҮҮСГЭХГҮЙ", () => {
  // Гараар sync хийгдсэн тохиолдол: run нь унасан хэвээр, гэхдээ ажил дууссан.
  const out = details([summary({ behind: false, lastSync: failedRun })]);
  assert.ok(!out.includes(syncFailedText));
});

test("хоцорсон үед унасан sync run анхааруулга ҮҮСНЭ", () => {
  const out = details([
    summary({ behind: true, health: { ok: true, version: "1.3.0" } as CustomerSummary["health"], lastSync: failedRun }),
  ]);
  assert.ok(out.includes(syncFailedText));
});

test("хувилбар уншигдаагүй (behind = null) үед анхааруулга ҮЛДЭНЭ", () => {
  const out = details([summary({ behind: null, health: null, lastSync: failedRun })]);
  assert.ok(out.includes(syncFailedText));
});

test("syncNote байвал «Авто sync саатсан» мөр гарна", () => {
  const out = details([
    summary({ customer: customer({ syncNote: "PR #6: merge хийх боломжгүй (dirty)" }) }),
  ]);
  assert.ok(out.some((d) => d.startsWith("Авто sync саатсан: PR #6")));
});
