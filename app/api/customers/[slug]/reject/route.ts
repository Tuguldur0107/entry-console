// REST: хүсэлт татгалзах (мөр `rejected` болж үлдэнэ).
//   POST /api/customers/<slug>/reject  {"reason":"…"}
import { authorized } from "../../auth";
import { getCustomerBySlug } from "@/lib/customers";
import { rejectRequest, SignupError } from "@/lib/signup";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  try {
    const rejected = await rejectRequest(customer, body.reason);
    return Response.json({ ok: true, customer: rejected });
  } catch (error) {
    if (error instanceof SignupError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
