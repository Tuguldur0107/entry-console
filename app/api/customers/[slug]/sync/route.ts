// REST: upstream-sync workflow эхлүүлэх (харилцагчийн хуудасны «Sync PR нээх» товчтой ижил).
//   POST /api/customers/<slug>/sync  {"ref":"v1.2.0"}  (ref өгөхгүй бол core-ийн сүүлийн release)
//   GET  /api/customers/<slug>/sync[?log=1]  → сүүлийн ажиллагаа, унасан алхам, secret төлөв
//   PUT  /api/customers/<slug>/sync          → sync workflow-г core-ийнхтэй тэнцүүлэх
import { authorized } from "../../auth";
import { getCustomerBySlug, logEvent } from "@/lib/customers";
import { dispatchWorkflow, getActionsPermissions, getDefaultBranch, getJobLogHead, getJobLogTail, getLatestRelease, GitHubError, getOrgActionsPermissions, hasRepoSecret, listRunJobs, listWorkflowRuns } from "@/lib/github";
import { config } from "@/lib/config";
import { bootstrapSyncWorkflow, PUSH_SECRET_NAME, SECRET_NAME, UpstreamAccessError } from "@/lib/upstream-access";

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
    const [runs, sshKey, pushKey, legacyToken, repoPerms, orgPerms] = await Promise.all([
      listWorkflowRuns(customer.githubRepo, "upstream-sync.yml", 3),
      hasRepoSecret(customer.githubRepo, SECRET_NAME).catch(() => false),
      hasRepoSecret(customer.githubRepo, PUSH_SECRET_NAME).catch(() => false),
      hasRepoSecret(customer.githubRepo, "UPSTREAM_TOKEN").catch(() => false),
      getActionsPermissions(customer.githubRepo).catch((e) => ({ error: String(e) })),
      getOrgActionsPermissions(config.owner).catch((e) => ({ error: String(e) })),
    ]);
    const wantLog = new URL(request.url).searchParams.get("log") === "1";
    const detailed = await Promise.all(
      runs.map(async (run) => {
        if (run.conclusion === "success")
          return { id: run.id, status: run.status, conclusion: run.conclusion, createdAt: run.createdAt, htmlUrl: run.htmlUrl, failedSteps: [] as string[] };
        const jobs = await listRunJobs(customer.githubRepo, run.id).catch(() => []);
        const failed = jobs.filter((j) => j.conclusion === "failure");
        return {
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          createdAt: run.createdAt,
          htmlUrl: run.htmlUrl,
          failedSteps: failed.flatMap((j) => j.steps.filter((st) => st.conclusion === "failure").map((st) => `${j.name} → ${st.name}`)),
          ...(wantLog && failed[0]
            ? { log: await getJobLogTail(customer.githubRepo, failed[0].id).catch((e) => `лог алга: ${e instanceof Error ? e.message : e}`) }
            : {}),
          ...(new URL(request.url).searchParams.get("setup") === "1" && failed[0]
            ? { setup: await getJobLogHead(customer.githubRepo, failed[0].id).catch((e) => `${e}`) }
            : {}),
        };
      })
    );
    return Response.json({
      ok: true,
      upstreamAccess: customer.upstreamAccess,
      secrets: { [SECRET_NAME]: sshKey, [PUSH_SECRET_NAME]: pushKey, UPSTREAM_TOKEN: legacyToken },
      actionsPermissions: { repo: repoPerms, org: orgPerms },
      runs: detailed,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

/** PUT — харилцагчийн sync workflow-г core-ийнхтэй тэнцүүлнэ (хуучин суулгац). */
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    const result = await bootstrapSyncWorkflow(customer);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof UpstreamAccessError) return Response.json({ ok: false, error: error.message }, { status: 422 });
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
    // Workflow файлуудыг урьдчилан тэнцүүлнэ — доорх «Push» тайлбарыг үзнэ үү
    await bootstrapSyncWorkflow(customer).catch(() => undefined);
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
