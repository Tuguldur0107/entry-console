// REST: хяналтын cron service идэвхжүүлэх (Тохиргоо хуудасны товчтой ижил).
//   POST /api/settings/monitoring   (session эсвэл CONSOLE_API_KEY)
import { authorized } from "../../customers/auth";
import { enableMonitoringCore, SetupError } from "@/lib/monitoring-setup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await enableMonitoringCore()) });
  } catch (error) {
    const status = error instanceof SetupError ? 422 : 500;
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
