// Хяналт — Railway cron service (entry-console-monitor) 5 мин тутам дуудна.
//   POST /api/cron/check   Authorization: Bearer <CONSOLE_API_KEY> (эсвэл session)
import { authorized } from "../../customers/auth";
import { runMonitor } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const summary = await runMonitor();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const GET = POST;
