// REST: хүсэлт батлах → provision (repo → Railway). Нэвтрэлт /api/customers-тай ижил.
//   POST /api/customers/<slug>/approve  {"ref":"v1.2.0","plan":"pilot","monthlyFee":"0","autoDeploy":true,"slug":"govi","githubUsers":"bat","note":"…"}
import { authorized } from "../../auth";
import { getCustomerBySlug } from "@/lib/customers";
import { GitHubError, getLatestRelease } from "@/lib/github";
import { ProvisionError } from "@/lib/provision";
import { approveRequest, SignupError, type ApproveInput } from "@/lib/signup";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as ApproveInput;
  try {
    const ref = body.ref ?? (await getLatestRelease().catch(() => null))?.tagName ?? "main";
    const approved = await approveRequest(customer, { autoDeploy: true, ...body, ref });
    return Response.json({ ok: true, customer: approved, url: `/customers/${approved.slug}` });
  } catch (error) {
    if (error instanceof SignupError || error instanceof ProvisionError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    if (error instanceof GitHubError) return Response.json({ ok: false, error: error.message }, { status: 502 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
