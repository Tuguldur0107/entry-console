// Upstream sync-ийн PR-ыг ENTRY CONSOLE нээнэ.
//
// Яагаад workflow биш вэ: GITHUB_TOKEN нь `pull-requests: write` эрхтэй байсан ч
// org-ийн repo дээр `createPullRequest`-ийг GitHub татгалздаг («Resource not
// accessible by integration») — амьд туршилтаар батлагдсан. Console нь
// хэрэглэгчийн PAT-аар ажилладаг тул энэ хязгаарлалтад ороогүй.
//
// Workflow нь салбарыг push хийгээд merge/шалгалтыг ТУСДАА НЭРТЭЙ алхмаар
// гүйцэтгэдэг. Алхмын conclusion нь GitHub API-аар уншигддаг тул үр дүнг эндээс
// сэргээж болно (step output нь API-аар уншигддаггүй).
import { config } from "./config";
import { logEvent } from "./customers";
import type { Customer } from "./db/schema";
import { addLabel, createPull, listBranches, listOpenSyncPulls, listRunJobs, listWorkflowRuns } from "./github";

export type SyncResult = "passed" | "failed" | "conflict" | "unknown";

const MERGE_STEP = "Merge туршилт";
const CHECK_STEP = "Шалгалт";

const LABELS: Record<Exclude<SyncResult, "unknown">, { name: string; color: string; description: string }> = {
  passed: { name: "sync-checks-passed", color: "0e8a16", description: "Merge туршилт + tsc/lint/test давсан — авто merge болно" },
  failed: { name: "sync-checks-failed", color: "d93f0b", description: "Шалгалт унасан — гараар шалгана" },
  conflict: { name: "sync-conflict", color: "b60205", description: "Merge conflict — гараар шийднэ" },
};

/** Сүүлийн дууссан sync ажиллагааны алхмуудаас үр дүнг гаргана. */
export async function latestSyncResult(fullName: string): Promise<{ result: SyncResult; runUrl: string | null }> {
  const runs = await listWorkflowRuns(fullName, "upstream-sync.yml", 5).catch(() => []);
  const run = runs.find((r) => r.status === "completed");
  if (!run) return { result: "unknown", runUrl: null };
  const jobs = await listRunJobs(fullName, run.id).catch(() => []);
  const steps = jobs.flatMap((j) => j.steps);
  const find = (needle: string) => steps.find((st) => st.name.startsWith(needle));
  const merge = find(MERGE_STEP);
  const checks = find(CHECK_STEP);
  if (!merge) return { result: "unknown", runUrl: run.htmlUrl };
  if (merge.conclusion === "failure") return { result: "conflict", runUrl: run.htmlUrl };
  if (checks?.conclusion === "failure") return { result: "failed", runUrl: run.htmlUrl };
  if (merge.conclusion === "success" && checks?.conclusion === "success") return { result: "passed", runUrl: run.htmlUrl };
  return { result: "unknown", runUrl: run.htmlUrl };
}

export interface OpenedPull {
  number: number;
  htmlUrl: string;
  branch: string;
  result: SyncResult;
}

/**
 * `upstream-sync/*` салбар бүрд PR байхгүй бол нээж, үр дүнгийн label тавина.
 * Идемпотент — PR аль хэдийн байвал юу ч хийхгүй.
 */
export async function openSyncPulls(customer: Customer, defaultBranch: string): Promise<OpenedPull[]> {
  const [branches, openPulls] = await Promise.all([
    listBranches(customer.githubRepo, "upstream-sync/"),
    listOpenSyncPulls(customer.githubRepo),
  ]);
  const withPr = new Set(openPulls.map((p) => p.headRef));
  const opened: OpenedPull[] = [];
  for (const branch of branches) {
    if (withPr.has(branch.name)) continue;
    const { result, runUrl } = await latestSyncResult(customer.githubRepo);
    const ref = branch.name.replace(/^upstream-sync\//, "");
    const label = result === "unknown" ? null : LABELS[result];
    const verdict =
      result === "passed"
        ? "Merge туршилт, tsc/lint/тест бүгд давсан — авто merge хийгдэнэ"
        : result === "failed"
          ? "Merge цэвэр боловч tsc/lint/тест унасан — гараар шалгана"
          : result === "conflict"
            ? "Merge conflict — гараар шийднэ (`custom/` талаас ирсэн эсэхийг шалга)"
            : "Шалгалтын үр дүн тодорхойгүй — ажиллагааны логийг үзнэ үү";
    const pr = await createPull(customer.githubRepo, {
      head: branch.name,
      base: defaultBranch,
      title: `Upstream sync: ${ref}`,
      body: [
        `Core repo \`${config.coreRepo}\`-ийн \`${ref}\` (\`${branch.sha.slice(0, 7)}\`) шинэчлэлт.`,
        "",
        `**Шалгалт:** \`${result}\` — ${verdict}`,
        runUrl ? `\nАжиллагаа: ${runUrl}` : "",
        "",
        "**Шалгах:**",
        "- [ ] Conflict байвал `custom/` талаас биш core талаас ирсэн эсэхийг шалга",
        "- [ ] Deploy хийсний дараа `/api/health` version шалга",
        "- [ ] Шинэ DDL байвал `npm run db:push` (Railway preDeployCommand автоматаар)",
        "",
        "_Энэ PR-ыг Entry Console нээв._",
      ].join("\n"),
    });
    if (label) await addLabel(customer.githubRepo, pr.number, label.name, label.color, label.description).catch(() => undefined);
    await logEvent(customer.id, "sync", `PR #${pr.number} нээгдэв (${ref}) — шалгалт: ${result}`);
    opened.push({ ...pr, branch: branch.name, result });
  }
  return opened;
}
