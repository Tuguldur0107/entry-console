// REST: харилцагч үүсгэх / жагсаах — автоматжуулалтад (Cowork, борлуулалтын
// форм, скрипт). Нэвтрэлт: console-ийн session cookie ЭСВЭЛ
// `Authorization: Bearer <CONSOLE_API_KEY>` (Railway variable, сонголтоор).
//
//   POST /api/customers  {"slug":"govi","displayName":"Говь ХК","githubUsers":"bat","plan":"pilot"}
//   GET  /api/customers  → бүртгэлийн жагсаалт (DB)
import { timingSafeEqual } from "node:crypto";
import { desc } from "drizzle-orm";

import { hasSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { customers } from "@/lib/db/schema";
import { GitHubError } from "@/lib/github";
import { provision, ProvisionError, type ProvisionInput } from "@/lib/provision";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  if (await hasSession()) return true;
  const key = process.env.CONSOLE_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  const given = header.replace(/^bearer\s+/i, "").trim();
  if (!key || !given || key.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(given));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await ensureSchema();
  const rows = await db.select().from(customers).orderBy(desc(customers.createdAt));
  return Response.json({ ok: true, customers: rows });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: ProvisionInput;
  try {
    body = (await request.json()) as ProvisionInput;
  } catch {
    return Response.json({ ok: false, error: "JSON body хэрэгтэй" }, { status: 400 });
  }
  if (!body?.slug || !body?.displayName)
    return Response.json({ ok: false, error: "slug, displayName заавал" }, { status: 400 });
  try {
    await ensureSchema();
    const created = await provision(body);
    return Response.json({ ok: true, customer: created, url: `/customers/${created.slug}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ProvisionError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    if (error instanceof GitHubError) return Response.json({ ok: false, error: error.message }, { status: 502 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
