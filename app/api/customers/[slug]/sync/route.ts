// REST: upstream-sync workflow эхлүүлэх (харилцагчийн хуудасны «Sync PR нээх» товчтой ижил).
//   POST /api/customers/<slug>/sync  {"ref":"v1.2.0"}  (ref өгөхгүй бол core-ийн сүүлийн release)
import { authorized } from "../../auth";
import { getCustomerBySlug, logEvent } from "@/lib/customers";
import { dispatchWorkflow, getDefaultBranch, getLatestRelease, GitHubError } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { ref?: string };
  try {
    const target = body.ref?.trim() || (await getLatestRelease())?.tagName || "main";
    const branch = await getDefaultBranch(customer.githubRepo);
    await dispatchWorkflow(customer.githubRepo, "upstream-sync.yml", branch, { ref: target });
    await logEvent(customer.id, "sync", `Upstream sync эхэллээ (REST): ${target}`);
    return Response.json({ ok: true, ref: target });
  } catch (error) {
    const status = error instanceof GitHubError ? 502 : 500;
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
