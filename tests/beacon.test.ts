// classifyBeacon — false-positive-ийн гол хувилбаруудыг батална.
import assert from "node:assert/strict";
import test from "node:test";

import { classifyBeacon } from "../lib/beacon";

const known = [{ appUrl: "https://goyol.entry.mn", customDomain: null }];

test("лицензтэй, домэйндоо → healthy, дохиогүй", () => {
  const r = classifyBeacon({
    appUrl: "https://goyol.entry.mn",
    licensedUrl: "https://goyol.entry.mn",
    hasValidLicense: true,
    candidateSlug: "goyol",
    matched: true,
    nodeEnv: "production",
    knownDomains: known,
  });
  assert.deepEqual(r, { verdict: "healthy", shouldAlert: false });
});

test("ХАРИЛЦАГЧ КОМ СОЛЬЖ локал ажиллуулав → дохиогүй (leaked ч local тул alert үгүй)", () => {
  const r = classifyBeacon({
    appUrl: "http://localhost:3000",
    licensedUrl: null,
    hasValidLicense: false, // локалд ENTRY_LICENSE env байхгүй
    candidateSlug: "goyol", // .entry-origin тэмдэг репод бий
    matched: true,
    nodeEnv: "development",
    knownDomains: known,
  });
  assert.equal(r.shouldAlert, false); // ← ком сольсон нь ХУДАЛ ДОХИО ӨГӨХГҮЙ
});

test("ЛЕГИТ ДОМЭЙН СОЛИЛТ (custom domain, лиценз хуучирсан) → healthy, дохиогүй", () => {
  const withCustom = [{ appUrl: "https://goyol-production.up.railway.app", customDomain: "https://goyol.entry.mn" }];
  const r = classifyBeacon({
    appUrl: "https://goyol.entry.mn", // шинэ custom domain-оор орж байна
    licensedUrl: "https://goyol-production.up.railway.app", // лиценз хуучин домэйнд
    hasValidLicense: true,
    candidateSlug: "goyol",
    matched: true,
    nodeEnv: "production",
    knownDomains: withCustom,
  });
  assert.deepEqual(r, { verdict: "healthy", shouldAlert: false });
});

test("ХУЛГАЙ: env хуулж production-д бүртгэлгүй домэйнд → mismatch, ДОХИОЛНО", () => {
  const r = classifyBeacon({
    appUrl: "https://stolen.vercel.app",
    licensedUrl: "https://goyol.entry.mn",
    hasValidLicense: true,
    candidateSlug: "goyol",
    matched: true,
    nodeEnv: "production",
    knownDomains: known,
  });
  assert.deepEqual(r, { verdict: "mismatch", shouldAlert: true });
});

test("ХУЛГАЙ: код алдагдаж production-д лицензгүй deploy → leaked, ДОХИОЛНО", () => {
  const r = classifyBeacon({
    appUrl: "https://thief.up.railway.app",
    licensedUrl: null,
    hasValidLicense: false,
    candidateSlug: "goyol", // .entry-origin-оор аль харилцагчийнх нь тодорхой
    matched: true,
    nodeEnv: "production",
    knownDomains: known,
  });
  assert.deepEqual(r, { verdict: "leaked", shouldAlert: true });
});

test("Танигдаагүй хуулбар production-д → unknown, ДОХИОЛНО", () => {
  const r = classifyBeacon({
    appUrl: "https://random.up.railway.app",
    licensedUrl: null,
    hasValidLicense: false,
    candidateSlug: null,
    matched: false,
    nodeEnv: "production",
    knownDomains: known,
  });
  assert.deepEqual(r, { verdict: "unknown", shouldAlert: true });
});
