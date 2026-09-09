import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, service: "entry-console", db: true });
  } catch (error) {
    return Response.json({ ok: false, service: "entry-console", db: false, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
