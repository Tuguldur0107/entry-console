// REST: харилцагчийг Railway-д deploy (эсвэл дахин deploy) — самбарын товчтой ИЖИЛ цөм.
//   POST /api/customers/<slug>/deploy   → шинэ service хос эсвэл байгааг дахин deploy
// Нэвтрэлт: session cookie ЭСВЭЛ Authorization: Bearer <CONSOLE_API_KEY> (/api/customers-тай ижил).
import { authorized } from "../../auth";
import { getCustomerBySlug } from "@/lib/customers";
import { DeployError, deployNow, redeployNow } from "@/lib/deploy";
import { getCustomerRepo } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    if (customer.railwayServiceId) {
      await redeployNow(customer);
      return Response.json({ ok: true, redeployed: true, appUrl: customer.appUrl });
    }
    const repo = await getCustomerRepo(slug);
    const next = await deployNow(customer, !!repo?.pushedAt);
    return Response.json({ ok: true, deployed: true, appUrl: next.appUrl, railwayServiceId: next.railwayServiceId }, { status: 201 });
  } catch (error) {
    // Service/DB/domain үүссэн ч repo холбогдоогүй → 202 (хагас амжилт, id-ууд хадгалагдсан)
    if (error instanceof DeployError && error.customer)
      return Response.json({ ok: false, partial: true, appUrl: error.customer.appUrl, railwayServiceId: error.customer.railwayServiceId, error: error.message }, { status: 202 });
    if (error instanceof DeployError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
