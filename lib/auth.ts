// Нэг админ, нууц үгээр — HMAC гарын үсэгтэй cookie session (DB-гүй).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { config } from "./config";

const COOKIE = "entry_console";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", config.authSecret).update(payload).digest("hex");
}

export function checkPassword(input: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(config.password).digest();
  return timingSafeEqual(a, b);
}

export async function createSession(): Promise<void> {
  const exp = String(Date.now() + TTL_MS);
  const store = await cookies();
  store.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Number(exp)),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect("/login");
}
