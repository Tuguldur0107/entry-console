// Эх кодтой (dedicated) хувилбарын ТУРШИЛТ — ЦЭВЭР дүрэм (DB, сүлжээ БАЙХГҮЙ; тесттэй).
//
// Нээлттэй /signup (entry.mn/own)-оор ирсэн хүсэлтийг батлахад repo + Railway
// бидний дансанд үүсдэг тул туршилт ХУГАЦААТАЙ: TRIAL_DAYS хоног. Дууссаны
// дараа Console анхааруулна; `TRIAL_AUTO_SUSPEND=1` үед хяналт автоматаар «Түр
// зогсоох» (volume/өгөгдөл хэвээр). Бүрэн УСТГАЛ ХЭЗЭЭ Ч автомат биш — зөвхөн
// анхааруулга (DELETE_AFTER_DAYS), устгах нь админы ИЛ үйлдэл.
//
// Туршилт зөвхөн `pilot` багцад үйлчилнэ — гэрээ (basic/pro) оноомогц дуусна.
import type { CustomerPlan, CustomerSource, CustomerStatus } from "./db/schema";

export const TRIAL_DAYS = 14;
/** Туршилт дууссанаас хойш устгах эсэхийг шийдэх анхааруулга гарах хоног */
export const DELETE_AFTER_DAYS = 30;
/** Дуусахаас өмнө анхааруулах хоног */
export const TRIAL_SOON_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Батлах мөчид туршилтын төгсгөл. Console-оос гараар нэмсэн харилцагчид туршилтгүй (гэрээтэй). */
export function trialEndsAtFor(source: CustomerSource, approvedAt: Date, days = TRIAL_DAYS): Date | null {
  if (source !== "signup" || !(days > 0)) return null;
  return new Date(approvedAt.getTime() + days * DAY_MS);
}

export type TrialState =
  | { kind: "none" }
  | { kind: "running"; daysLeft: number }
  | { kind: "expired"; daysAgo: number; deleteDue: boolean };

export function trialState(
  c: { trialEndsAt: Date | null; plan: CustomerPlan; status: CustomerStatus },
  now: Date
): TrialState {
  if (!c.trialEndsAt || c.plan !== "pilot") return { kind: "none" };
  if (c.status === "pending" || c.status === "rejected" || c.status === "archived") return { kind: "none" };
  const diff = c.trialEndsAt.getTime() - now.getTime();
  if (diff > 0) return { kind: "running", daysLeft: Math.ceil(diff / DAY_MS) };
  const daysAgo = Math.floor(-diff / DAY_MS);
  return { kind: "expired", daysAgo, deleteDue: daysAgo >= DELETE_AFTER_DAYS };
}

/** Хяналт энэ удаа юу хийх вэ: нэг удаагийн мэдэгдэл ба (асаалттай бол) зогсоолт. */
export function trialMonitorAction(
  c: { trialEndsAt: Date | null; trialAlertedAt: Date | null; plan: CustomerPlan; status: CustomerStatus },
  now: Date,
  autoSuspend: boolean
): { alert: boolean; suspend: boolean } {
  const s = trialState(c, now);
  if (s.kind !== "expired" || c.status !== "active") return { alert: false, suspend: false };
  return { alert: !c.trialAlertedAt, suspend: autoSuspend };
}

// ── Хүсэлтийн шүүлтүүр асуулт → requestNote ─────────────────────────────────

export const SIGNUP_EMPLOYEE_OPTIONS = ["1–10", "11–50", "51–200", "200+"] as const;
export const SIGNUP_DEVELOPER_OPTIONS = ["Өөрийн хөгжүүлэгч", "Claude Code / AI-аар өөрсдөө", "Гадны компани", "Хөгжүүлэгчгүй"] as const;

export interface SignupScreening {
  employees?: string;
  developer?: string;
  /** Юуг өөрчлөх / нэмэх гэж байгаа */
  goal?: string;
  /** Хаанаас ирсэн (landing, cowork …) — богино латин */
  channel?: string;
}

const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Шүүлтүүр хариултыг тайлбарын эхэнд бүтэцтэй мөрөөр нэгтгэнэ (шинэ багана нэмэхгүй). */
export function composeSignupNote(note: string | undefined, s: SignupScreening): string {
  const lines: string[] = [];
  const channel = clean(s.channel, 24).replace(/[^a-z0-9_-]/gi, "");
  if (channel) lines.push(`Суваг: ${channel}`);
  const employees = clean(s.employees, 20);
  if (employees) lines.push(`Ажилтан: ${employees}`);
  const developer = clean(s.developer, 60);
  if (developer) lines.push(`Код хэн бичих: ${developer}`);
  const goal = clean(s.goal, 600);
  if (goal) lines.push(`Өөрчлөх зүйл: ${goal}`);
  const rest = (note ?? "").trim();
  return [...lines, ...(rest ? [rest] : [])].join("\n").slice(0, 2000);
}
