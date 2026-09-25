// Багцын QPay төлбөрийн цэвэр давхарга — сарын орлого (УБ цагаар), шүүлт.
import assert from "node:assert/strict";
import test from "node:test";

import {
  describePaymentTerm,
  filterBillingPayments,
  paidAmountOf,
  summarizeBillingPayments,
  ubMonth,
  type SaasBillingPayment,
} from "../lib/saas-billing";

function payment(patch: Partial<SaasBillingPayment>): SaasBillingPayment {
  return {
    id: "p-" + Math.random().toString(16).slice(2),
    organizationId: "org-a",
    orgName: "Алтан ХХК",
    payerEmail: "owner@altan.mn",
    planId: "skills",
    seats: 1,
    months: 1,
    pricePerSeatMnt: 29_000,
    amount: 29_000,
    status: "paid",
    qpayInvoiceId: "inv-1",
    paymentId: null,
    paidAmount: 29_000,
    paidAt: "2026-09-20T03:00:00.000Z",
    periodStart: null,
    periodEnd: null,
    lastError: null,
    createdAt: "2026-09-20T02:59:00.000Z",
    ...patch,
  };
}

const NOW = new Date("2026-09-25T10:00:00.000Z");

test("ubMonth — Улаанбаатарын цагаар (UTC 16:30 = УБ дараа өдөр 00:30)", () => {
  assert.equal(ubMonth("2026-09-30T16:30:00.000Z"), "2026-10");
  assert.equal(ubMonth("2026-09-30T15:59:00.000Z"), "2026-09");
});

test("нэгтгэл — зөвхөн төлөгдсөн нь орлогод; алдаатай, нээлттэйг тусад нь тоолно", () => {
  const rows = [
    payment({ amount: 87_000, paidAmount: 87_000, months: 3 }),
    payment({ organizationId: "org-b", paidAt: "2026-08-30T03:00:00.000Z" }),
    payment({ organizationId: "org-c", status: "failed", paidAmount: 20_000 }),
    payment({ organizationId: "org-d", status: "open", paidAmount: null, paidAt: null }),
    payment({ organizationId: "org-e", status: "expired", paidAmount: null, paidAt: null }),
  ];
  const summary = summarizeBillingPayments(rows, NOW);
  assert.equal(summary.thisMonthMnt, 87_000);
  assert.equal(summary.thisMonthCount, 1);
  assert.equal(summary.last30dMnt, 87_000 + 29_000, "8-30 нь 30 хоногийн дотор");
  assert.equal(summary.failed, 1);
  assert.equal(summary.open, 1);
  assert.equal(summary.payingOrgs, 2);
});

test("paidAmount байхгүй бол нэхэмжлэхийн дүн", () => {
  assert.equal(paidAmountOf(payment({ paidAmount: null, amount: 58_000 })), 58_000);
});

test("шүүлт — төлөв ба нэр / и-мэйл / нэхэмжлэхийн дугаараар", () => {
  const rows = [
    payment({ orgName: "Алтан ХХК" }),
    payment({ orgName: "Мөнгөн ХХК", payerEmail: "bat@mongon.mn", status: "failed", qpayInvoiceId: "INV-77" }),
  ];
  assert.equal(filterBillingPayments(rows, { status: "failed" }).length, 1);
  assert.equal(filterBillingPayments(rows, { q: "bat@" }).length, 1);
  assert.equal(filterBillingPayments(rows, { q: "inv-77" }).length, 1);
  assert.equal(filterBillingPayments(rows, {}).length, 2);
});

test("хугацааны тайлбар", () => {
  assert.equal(describePaymentTerm({ months: 12, seats: 3 }), "12 сар · 3 суудал");
});
