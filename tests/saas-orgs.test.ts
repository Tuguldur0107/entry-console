// Байгууллагын дэлгэрэнгүй + дэмжлэгийн хандалтын ЦЭВЭР дүрмүүд.
import assert from "node:assert/strict";
import test from "node:test";

import {
  byMemberRole,
  isOrgActive,
  moduleLabel,
  openSupportSessions,
  parseSupportRequest,
  profileGaps,
  type SaasOrgDetail,
  type SaasOrgMember,
  type SaasSupportSession,
} from "../lib/saas-orgs";

function member(over: Partial<SaasOrgMember> = {}): SaasOrgMember {
  return {
    userId: over.userId ?? "u1",
    name: over.name ?? null,
    email: over.email ?? "a@example.com",
    role: over.role ?? "viewer",
    emailVerified: over.emailVerified ?? true,
    joinedAt: over.joinedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function detail(over: Partial<SaasOrgDetail> = {}): SaasOrgDetail {
  return {
    organizationId: "org-1",
    name: "Тест ХХК",
    registryNo: "1234567",
    createdAt: "2026-01-01T00:00:00.000Z",
    profile: null,
    members: [],
    disabledModules: [],
    settings: { isVatPayer: null, posEnabled: false, ebarimtEnabled: false },
    usage: {
      journalVouchers: 0,
      counterparties: 0,
      inventoryItems: 0,
      fixedAssets: 0,
      cashAccounts: 0,
      arApDocuments: 0,
      employees: 0,
      apiTokens: 0,
      closedPeriods: 0,
      lastClosedPeriod: null,
    },
    lastActivityAt: null,
    supportSessions: [],
    ...over,
  };
}

function session(over: Partial<SaasSupportSession> = {}): SaasSupportSession {
  return {
    id: over.id ?? "s1",
    organizationId: "org-1",
    orgName: "Тест ХХК",
    userId: "u1",
    email: "ops@example.com",
    role: over.role ?? "viewer",
    reason: null,
    issuedBy: "Entry Console",
    state: over.state ?? "pending",
    expiresAt: "2026-09-20T10:15:00.000Z",
    startedAt: null,
    endsAt: null,
    endedAt: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...over,
  };
}

test("дэмжлэгийн хүсэлт: и-мэйл заавал, хэлбэр шалгагдана", () => {
  assert.deepEqual(parseSupportRequest({ email: "  ", role: "viewer", reason: "" }), {
    ok: false,
    error: "Entry дансны и-мэйл шаардлагатай",
  });
  const bad = parseSupportRequest({ email: "буруу", role: "viewer", reason: "" });
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? "" : bad.error, /хэлбэр буруу/);
});

test("и-мэйл жижиг үсэг болж, зай тайрагдана", () => {
  const parsed = parseSupportRequest({ email: "  OPS@Example.COM ", role: "", reason: "" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.value.email, "ops@example.com");
});

test("түвшин өгөгдөөгүй бол ХАМГИЙН болгоомжтой нь (viewer)", () => {
  const parsed = parseSupportRequest({ email: "a@b.mn", role: "", reason: "" });
  assert.equal(parsed.ok && parsed.value.role, "viewer");
});

test("танигдахгүй түвшинг ЧИМЭЭГҮЙ буулгахгүй", () => {
  const parsed = parseSupportRequest({ email: "a@b.mn", role: "owner", reason: "" });
  assert.equal(parsed.ok, false);
  assert.match(parsed.ok ? "" : parsed.error, /танигдсангүй/);
});

test("шалтгаан: хоосон → null, 300 тэмдэгтээр таслагдана", () => {
  const empty = parseSupportRequest({ email: "a@b.mn", role: "admin", reason: "   " });
  assert.equal(empty.ok && empty.value.reason, null);
  const long = parseSupportRequest({ email: "a@b.mn", role: "admin", reason: "я".repeat(500) });
  assert.equal(long.ok && long.value.reason?.length, 300);
});

test("нээлттэй сесс = идэвхтэй + хүлээгдэж буй", () => {
  const rows = [
    session({ id: "a", state: "active" }),
    session({ id: "b", state: "pending" }),
    session({ id: "c", state: "expired" }),
    session({ id: "d", state: "ended" }),
  ];
  assert.deepEqual(
    openSupportSessions(rows).map((row) => row.id),
    ["a", "b"]
  );
});

test("гишүүдийн эрэмбэ: эзэн → админ → нягтлан → харагч, дараа и-мэйлээр", () => {
  const rows = [
    member({ userId: "1", role: "viewer", email: "z@b.mn" }),
    member({ userId: "2", role: "owner", email: "o@b.mn" }),
    member({ userId: "3", role: "accountant", email: "b@b.mn" }),
    member({ userId: "4", role: "accountant", email: "a@b.mn" }),
    member({ userId: "5", role: "цоо_шинэ", email: "x@b.mn" }),
  ];
  assert.deepEqual(
    [...rows].sort(byMemberRole).map((row) => row.userId),
    ["2", "4", "3", "1", "5"]
  );
});

test("эрэмбэ нь localeCompare ХЭРЭГЛЭХГҮЙ — Node/браузарын ICU зөрөхгүй", () => {
  // Ижил роль, ижил и-мэйл → 0 (тогтвортой эрэмбэ).
  assert.equal(byMemberRole(member(), member()), 0);
});

test("профайлын дутуу хэсгүүд нэрлэгдэнэ", () => {
  assert.deepEqual(profileGaps(detail()), ["Компанийн мэдээлэл огт бөглөөгүй"]);
  const gaps = profileGaps(
    detail({
      profile: {
        name: "Тест ХХК",
        registerNo: null,
        vatPayerNo: null,
        address: "УБ",
        phone: null,
        email: "a@b.mn",
        bankAccountCount: 0,
        hasLogo: false,
        hasStamp: false,
        invoiceFromEmail: null,
        emailDomainVerified: false,
        aiPostLimitMnt: null,
        largeAmountAlertMnt: null,
        updatedAt: null,
      },
    })
  );
  assert.deepEqual(gaps, ["Регистрийн дугаар", "Утас", "Банкны данс"]);
});

test("идэвхтэй байгууллага = журнал эсвэл АР/АП бичилттэй", () => {
  assert.equal(isOrgActive(detail()), false);
  assert.equal(
    isOrgActive(detail({ usage: { ...detail().usage, journalVouchers: 3 } })),
    true
  );
  assert.equal(
    isOrgActive(detail({ usage: { ...detail().usage, arApDocuments: 1 } })),
    true
  );
});

test("модулийн шошго — танигдахгүй түлхүүр өөрөө хэвээр", () => {
  assert.equal(moduleLabel("pos"), "Борлуулалтын цэг");
  assert.equal(moduleLabel("шинэ_модуль"), "шинэ_модуль");
});
