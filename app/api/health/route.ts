import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

const sha = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7) || null;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, service: "entry-console", db: true, sha });
  } catch (error) {
    return Response.json({ ok: false, service: "entry-console", db: false, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
