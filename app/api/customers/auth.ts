// REST нэвтрэлт: console-ийн session cookie ЭСВЭЛ `Authorization: Bearer <CONSOLE_API_KEY>`.
import { timingSafeEqual } from "node:crypto";

import { hasSession } from "@/lib/auth";

export async function authorized(request: Request): Promise<boolean> {
  if (await hasSession()) return true;
  const key = process.env.CONSOLE_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  const given = header.replace(/^bearer\s+/i, "").trim();
  if (!key || !given || key.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(given));
}
