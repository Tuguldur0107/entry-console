// Upstream sync-ийн PR-ыг ENTRY CONSOLE нээнэ.
//
// Яагаад workflow биш вэ: GITHUB_TOKEN нь `pull-requests: write` эрхтэй байсан ч
// org-ийн repo дээр `createPullRequest`-ийг GitHub татгалздаг («Resource not
// accessible by integration») — амьд туршилтаар батлагдсан. Console нь
// хэрэглэгчийн PAT-аар ажилладаг тул энэ хязгаарлалтад ороогүй.
//
// Workflow нь салбарыг push хийгээд merge/шалгалтыг ТУСДАА НЭРТЭЙ алхмаар
// гүйцэтгэдэг. Үр дүнг хоёр эх сурвалжаас уншина:
//
//  1) ЛОГ (найдвартай): «Дүгнэлт» алхам `Үр дүн: passed|failed|conflict` гэж
//     хэвлэдэг. Энэ нь `steps.*.outcome`-оос бодогддог тул ҮНЭН.
//  2) Алхмын conclusion (нөөц зам): ЗӨВХӨН ойролцоо. `continue-on-error: true`
//     алхам УНАСАН ч GitHub API `conclusion: "success"` гэж буцаадаг (бодит
//     алдаа нь зөвхөн `outcome`-д үлддэг, тэр нь API-аар уншигддаггүй) —
//     тиймээс merge унасныг «Шалгалт» алхам АЖИЛЛААГҮЙГЭЭР нь таньдаг: тэр
//     алхам `steps.mergetest.outcome == 'success'` үед л ажилладаг.
//
// (2)-ыг ганцаар ашиглавал conflict нь «unknown» болж, PR нь label-гүй
// нээгдээд авто sync ЧИМЭЭГҮЙ зогсдог байв — smartgps 2026-09-16.
//
// Салбар нь ажиллагааны ДУНД (шалгалтаас өмнө) push хийгддэг тул monitor PR-ыг
// шалгалт дуусахаас өмнө нээж, ӨМНӨХ (өөр ref-ийн) дууссан ажиллагааны үр дүнг
// уншдаг байв — smartgps 2026-10-03 v1.8.0: «Шалгалт: unknown», label-гүй PR.
// Өмнөх ажиллагаа `passed` байсан бол шинэ PR ХУУЧИН үр дүнгээр авто merge
// болох эрсдэлтэй. Одоо: сүүлийн ажиллагаа явж байвал `pending` (PR нээхгүй,
// label тавихгүй — дараагийн tick), үр дүнг ЗӨВХӨН тухайн салбарыг хэвлэсэн
// ажиллагааны логоос авна.
import { config } from "./config";
import { logEvent } from "./customers";
import type { Customer } from "./db/schema";
import { addLabel, createPull, getJobLog, listBranches, listOpenSyncPulls, listRunJobs, listWorkflowRuns, removeLabel } from "./github";

export type SyncResult = "passed" | "failed" | "conflict" | "unknown" | "pending";

const MERGE_STEP = "Merge туршилт";
const CHECK_STEP = "Шалгалт";

const LABELS: Record<Exclude<SyncResult, "unknown" | "pending">, { name: string; color: string; description: string }> = {
  passed: { name: "sync-checks-passed", color: "0e8a16", description: "Merge туршилт + tsc/lint/test давсан — авто merge болно" },
  failed: { name: "sync-checks-failed", color: "d93f0b", description: "Шалгалт унасан — гараар шалгана" },
  conflict: { name: "sync-conflict", color: "b60205", description: "Merge conflict — гараар шийднэ" },
};

/** «Дүгнэлт» алхмын хэвлэсэн `Үр дүн: …` мөрөөс уншина (ЦЭВЭР, тесттэй). */
export function parseResultFromLog(log: string): SyncResult | null {
  let found: SyncResult | null = null;
  for (const line of log.split("\n")) {
    // Логийн эхэнд ажиллах скрипт өөрөө ч хэвлэгддэг (`Үр дүн: $RESULT`) —
    // тэр нь утга агуулаагүй тул тааруулагдахгүй. Сүүлийн таарсан нь эцсийнх.
    const match = line.match(/Үр дүн:\s*(passed|failed|conflict)\b/i);
    if (match) found = match[1].toLowerCase() as SyncResult;
  }
  return found;
}

/**
 * Ажиллагааны лог ЭНЭ sync салбарынх эсэх (ЦЭВЭР, тесттэй). «Дүгнэлт» алхам
 * `Салбар: \`upstream-sync/<ref>\`` гэж хэвлэдэг; `upstream-sync/v1.8` нь
 * `upstream-sync/v1.8.0`-тэй андуурагдахгүйн тулд араас нь backtick / `\` шаардана.
 */
export function logMentionsBranch(log: string, branch: string): boolean {
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}[\`\\\\]`).test(log);
}

/** Алхмын conclusion-оос үр дүнг ойролцоогоор гаргана (ЦЭВЭР, тесттэй). */
export function resultFromSteps(
  merge: { conclusion: string | null } | undefined,
  checks: { conclusion: string | null } | undefined
): SyncResult {
  // Merge алхам огт байхгүй / алгасагдсан = fork аль хэдийн шинэчлэгдсэн.
  if (!merge || merge.conclusion === "skipped") return "unknown";
  if (merge.conclusion === "failure") return "conflict";
  // Merge унасан үед л «Шалгалт» алхам алгасагддаг (түүний `if` нөхцөл).
  if (!checks || checks.conclusion === "skipped") return "conflict";
  if (checks.conclusion === "failure") return "failed";
  if (checks.conclusion === "success") return "passed";
  return "unknown";
}

/**
 * Sync ажиллагааны үр дүн: эхлээд лог, дараа нь алхмууд.
 *
 * - Хамгийн сүүлийн ажиллагаа дуусаагүй бол `pending` — үр дүн хараахан алга.
 * - `branch` өгвөл ЗӨВХӨН тэр салбарыг хэвлэсэн ажиллагааг тооцно (өөр ref-ийн
 *   ажиллагааны үр дүнг ХЭЗЭЭ Ч хэрэглэхгүй); олдохгүй бол `unknown`.
 */
export async function latestSyncResult(
  fullName: string,
  branch?: string
): Promise<{ result: SyncResult; runUrl: string | null }> {
  const runs = await listWorkflowRuns(fullName, "upstream-sync.yml", 5).catch(() => []);
  const latest = runs[0];
  if (latest && latest.status !== "completed") return { result: "pending", runUrl: latest.htmlUrl };
  for (const run of runs) {
    if (run.status !== "completed") continue;
    const jobs = await listRunJobs(fullName, run.id).catch(() => []);
    const steps = jobs.flatMap((j) => j.steps);
    const find = (needle: string) => steps.find((st) => st.name.startsWith(needle));
    const merge = find(MERGE_STEP);
    const checks = find(CHECK_STEP);
    if (!merge) {
      if (branch) continue;
      return { result: "unknown", runUrl: run.htmlUrl };
    }
    const job = jobs.find((j) => j.steps.some((st) => st.name.startsWith(MERGE_STEP)));
    const log = job ? await getJobLog(fullName, job.id).catch(() => "") : "";
    if (branch && !logMentionsBranch(log, branch)) continue;
    const fromLog = parseResultFromLog(log);
    if (fromLog) return { result: fromLog, runUrl: run.htmlUrl };
    return { result: resultFromSteps(merge, checks), runUrl: run.htmlUrl };
  }
  return { result: "unknown", runUrl: latest?.htmlUrl ?? null };
}

const ALL_LABELS = Object.values(LABELS).map((l) => l.name);

/** PR дээр үр дүнгийн label-ыг тавина; бусад sync label-ыг авна. Идемпотент. */
async function applyLabel(fullName: string, number: number, result: SyncResult, current: string[]): Promise<boolean> {
  if (result === "unknown" || result === "pending") return false;
  const want = LABELS[result];
  if (current.includes(want.name) && current.filter((l) => ALL_LABELS.includes(l)).length === 1) return false;
  for (const stale of current.filter((l) => ALL_LABELS.includes(l) && l !== want.name))
    await removeLabel(fullName, number, stale).catch(() => undefined);
  await addLabel(fullName, number, want.name, want.color, want.description);
  return true;
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

  // Аль хэдийн нээлттэй PR-уудын label-ыг мөн засна: workflow нь label тавьж
  // чаддаггүй болсон тул шошгогүй PR үлдэж, авто merge ажиллахгүй байдаг.
  for (const p of openPulls) {
    const { result } = await latestSyncResult(customer.githubRepo, p.headRef);
    if (await applyLabel(customer.githubRepo, p.number, result, p.labels))
      await logEvent(customer.id, "sync", `PR #${p.number} label: ${result}`);
  }
  for (const branch of branches) {
    if (withPr.has(branch.name)) continue;
    const { result, runUrl } = await latestSyncResult(customer.githubRepo, branch.name);
    // Шалгалт дуусаагүй — PR-ыг дараагийн tick-д ЗӨВ үр дүнтэй нь нээнэ.
    if (result === "pending") continue;
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
    void label;
    await logEvent(customer.id, "sync", `PR #${pr.number} нээгдэв (${ref}) — шалгалт: ${result}`);
    opened.push({ ...pr, branch: branch.name, result });
  }
  return opened;
}
