// REST: харилцагч үүсгэх / жагсаах — автоматжуулалтад (Cowork, борлуулалтын
// форм, скрипт). Нэвтрэлт: console-ийн session cookie ЭСВЭЛ
// `Authorization: Bearer <CONSOLE_API_KEY>` (Railway variable, сонголтоор).
//
//   POST /api/customers  {"slug":"govi","displayName":"Говь ХК","githubUsers":"bat","plan":"pilot","autoDeploy":true}
//   GET  /api/customers?status=pending  → бүртгэлийн жагсаалт (DB; status-аар шүүж болно)
//   POST /api/customers/<slug>/deploy → Railway deploy ([slug]/deploy/route.ts)
import { desc, eq } from "drizzle-orm";

import { authorized } from "./auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { CUSTOMER_STATUSES, customers, type CustomerStatus } from "@/lib/db/schema";
import { GitHubError } from "@/lib/github";
import { provision, ProvisionError, type ProvisionInput } from "@/lib/provision";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await ensureSchema();
  const status = new URL(request.url).searchParams.get("status") as CustomerStatus | null;
  if (status && !CUSTOMER_STATUSES.includes(status)) return Response.json({ ok: false, error: "status буруу" }, { status: 400 });
  const rows = await db
    .select()
    .from(customers)
    .where(status ? eq(customers.status, status) : undefined)
    .orderBy(desc(customers.createdAt));
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
    const created = await provision(body, "api");
    return Response.json({ ok: true, customer: created, url: `/customers/${created.slug}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ProvisionError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    if (error instanceof GitHubError) return Response.json({ ok: false, error: error.message }, { status: 502 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
