// REST: upstream-sync workflow эхлүүлэх (харилцагчийн хуудасны «Sync PR нээх» товчтой ижил).
//   POST /api/customers/<slug>/sync  {"ref":"v1.2.0"}  (ref өгөхгүй бол core-ийн сүүлийн release)
import { authorized } from "../../auth";
import { getCustomerBySlug, logEvent } from "@/lib/customers";
import { dispatchWorkflow, getDefaultBranch, getLatestRelease, GitHubError, hasRepoSecret, listRunJobs, listWorkflowRuns } from "@/lib/github";
import { SECRET_NAME } from "@/lib/upstream-access";

export const dynamic = "force-dynamic";

/**
 * GET — сүүлийн sync ажиллагаануудын оношлогоо: унасан АЛХМЫН нэр хүртэл.
 * Лог татахгүйгээр «яагаад унав» гэдгийг хэлнэ (fetch уу, tsc уу, conflict уу).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    const [runs, sshKey, legacyToken] = await Promise.all([
      listWorkflowRuns(customer.githubRepo, "upstream-sync.yml", 3),
      hasRepoSecret(customer.githubRepo, SECRET_NAME).catch(() => false),
      hasRepoSecret(customer.githubRepo, "UPSTREAM_TOKEN").catch(() => false),
    ]);
    const detailed = await Promise.all(
      runs.map(async (run) => ({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.createdAt,
        htmlUrl: run.htmlUrl,
        failedSteps:
          run.conclusion === "success"
            ? []
            : (await listRunJobs(customer.githubRepo, run.id).catch(() => []))
                .flatMap((j) => j.steps.filter((st) => st.conclusion === "failure").map((st) => `${j.name} → ${st.name}`)),
      }))
    );
    return Response.json({
      ok: true,
      upstreamAccess: customer.upstreamAccess,
      secrets: { [SECRET_NAME]: sshKey, UPSTREAM_TOKEN: legacyToken },
      runs: detailed,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  if (!customer.upstreamAccess)
    return Response.json(
      { ok: false, error: "Шинэчлэлт авах эрх цуцлагдсан — PATCH {\"upstreamAccess\":true} -ээр сэргээнэ" },
      { status: 409 }
    );
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
