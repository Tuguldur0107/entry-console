// Эх кодтой хувилбарын туршилт (lib/trial.ts) — хугацаа, мэдэгдэл, зогсоолт, тайлбар.
import assert from "node:assert/strict";
import test from "node:test";

import { composeSignupNote, DELETE_AFTER_DAYS, TRIAL_DAYS, trialEndsAtFor, trialMonitorAction, trialState } from "../lib/trial";

const approved = new Date("2026-11-01T00:00:00Z");
const day = 24 * 60 * 60 * 1000;
const at = (d: number) => new Date(approved.getTime() + d * day);

test("туршилт зөвхөн нээлттэй хүсэлтэд, 0 хоног = туршилтгүй", () => {
  assert.equal(trialEndsAtFor("signup", approved)?.getTime(), at(TRIAL_DAYS).getTime());
  assert.equal(trialEndsAtFor("console", approved), null);
  assert.equal(trialEndsAtFor("api", approved), null);
  assert.equal(trialEndsAtFor("signup", approved, 0), null);
});

test("төлөв: явж буй → дууссан → устгах эсэхийг шийдэх", () => {
  const c = { trialEndsAt: at(14), plan: "pilot" as const, status: "active" as const };
  assert.deepEqual(trialState(c, at(12)), { kind: "running", daysLeft: 2 });
  assert.deepEqual(trialState(c, at(15)), { kind: "expired", daysAgo: 1, deleteDue: false });
  assert.equal((trialState({ ...c, status: "suspended" }, at(14 + DELETE_AFTER_DAYS)) as { deleteDue: boolean }).deleteDue, true);
});

test("гэрээтэй багц эсвэл архивт туршилт хамаарахгүй", () => {
  assert.deepEqual(trialState({ trialEndsAt: at(14), plan: "basic", status: "active" }, at(30)), { kind: "none" });
  assert.deepEqual(trialState({ trialEndsAt: at(14), plan: "pilot", status: "archived" }, at(30)), { kind: "none" });
  assert.deepEqual(trialState({ trialEndsAt: null, plan: "pilot", status: "active" }, at(30)), { kind: "none" });
});

test("хяналт: мэдэгдэл НЭГ удаа, зогсоолт зөвхөн асаалттай үед, устгал хэзээ ч үгүй", () => {
  const c = { trialEndsAt: at(14), trialAlertedAt: null, plan: "pilot" as const, status: "active" as const };
  assert.deepEqual(trialMonitorAction(c, at(10), true), { alert: false, suspend: false });
  assert.deepEqual(trialMonitorAction(c, at(15), false), { alert: true, suspend: false });
  assert.deepEqual(trialMonitorAction({ ...c, trialAlertedAt: at(15) }, at(16), false), { alert: false, suspend: false });
  assert.deepEqual(trialMonitorAction(c, at(15), true), { alert: true, suspend: true });
  assert.deepEqual(trialMonitorAction({ ...c, status: "suspended" }, at(60), true), { alert: false, suspend: false });
});

test("шүүлтүүр хариулт тайлбарт бүтэцтэй мөрөөр", () => {
  const note = composeSignupNote("Одоо Excel ашигладаг", { channel: "landing", employees: "11–50", developer: "Claude Code / AI-аар өөрсдөө", goal: "  CRM-тэй\nхолбох " });
  assert.equal(note, "Суваг: landing\nАжилтан: 11–50\nКод хэн бичих: Claude Code / AI-аар өөрсдөө\nӨөрчлөх зүйл: CRM-тэй холбох\nОдоо Excel ашигладаг");
  assert.equal(composeSignupNote("", {}), "");
  assert.equal(composeSignupNote(undefined, { channel: "<script>" }), "Суваг: script");
  assert.ok(composeSignupNote("x".repeat(5000), {}).length <= 2000);
});
