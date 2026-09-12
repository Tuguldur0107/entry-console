// GitHub REST давхарга — console-ийн ЦОРЫН ГАНЦ өгөгдлийн эх сурвалж.
// Харилцагч = `entry-customer` topic-той repo; тохиргоо нь repo variables
// (ENTRY_DISPLAY_NAME, ENTRY_APP_URL); статус нь workflow run-ууд.
import { config } from "./config";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const body = JSON.parse(text) as { message?: string; errors?: { message?: string; field?: string; code?: string }[] };
      message = body.message ?? text;
      // GitHub-ийн "Validation Failed" нь дэлгэрэнгүйг errors[]-д өгдөг —
      // үүнгүйгээр шалтгаан огт мэдэгдэхгүй.
      const detail = (body.errors ?? []).map((e) => e.message ?? [e.field, e.code].filter(Boolean).join(" ")).filter(Boolean);
      if (detail.length) message = `${message}: ${detail.join("; ")}`;
    } catch {
      /* raw text */
    }
    throw new GitHubError(response.status, `GitHub ${response.status}: ${message}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ── Төрлүүд ────────────────────────────────────────────────────────────────

export interface CustomerRepo {
  slug: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  createdAt: string;
  pushedAt: string | null;
  topics: string[];
}

export interface WorkflowRun {
  id: number;
  name: string;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  headBranch: string;
}

export interface Collaborator {
  login: string;
  htmlUrl: string;
  permission: string;
  pending?: boolean;
}

export interface Release {
  tagName: string;
  htmlUrl: string;
  publishedAt: string | null;
}

interface RawRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  pushed_at: string | null;
  topics?: string[];
}

function toRepo(raw: RawRepo): CustomerRepo {
  return {
    slug: raw.name.startsWith(config.repoPrefix)
      ? raw.name.slice(config.repoPrefix.length)
      : raw.name,
    fullName: raw.full_name,
    htmlUrl: raw.html_url,
    description: raw.description,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    topics: raw.topics ?? [],
  };
}

// ── Харилцагчийн repo ──────────────────────────────────────────────────────

export async function listCustomerRepos(): Promise<CustomerRepo[]> {
  const path =
    config.ownerType === "org"
      ? `/orgs/${config.owner}/repos?per_page=100&type=all&sort=created`
      : `/user/repos?per_page=100&affiliation=owner&sort=created`;
  const repos = await gh<RawRepo[]>(path);
  return repos
    .filter((r) => (r.topics ?? []).includes(config.customerTopic))
    .filter((r) => r.full_name.split("/")[0].toLowerCase() === config.owner.toLowerCase())
    .map(toRepo);
}

export async function getCustomerRepo(slug: string): Promise<CustomerRepo | null> {
  try {
    const raw = await gh<RawRepo>(`/repos/${config.owner}/${config.repoPrefix}${slug}`);
    if (!(raw.topics ?? []).includes(config.customerTopic)) return null;
    return toRepo(raw);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export async function getVariable(fullName: string, name: string): Promise<string | null> {
  try {
    const v = await gh<{ value: string }>(`/repos/${fullName}/actions/variables/${name}`);
    return v.value || null;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export async function setVariable(fullName: string, name: string, value: string): Promise<void> {
  try {
    await gh(`/repos/${fullName}/actions/variables/${name}`, {
      method: "PATCH",
      body: JSON.stringify({ name, value }),
    });
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
    await gh(`/repos/${fullName}/actions/variables`, {
      method: "POST",
      body: JSON.stringify({ name, value }),
    });
  }
}

// ── Deploy key (core repo дээр) ба Actions secret (харилцагчийн repo дээр) ──
// Хоёулаа «шинэчлэлт авах эрх»-ийн механизмд ордог: core дээр харилцагч бүрд
// read-only deploy key, харилцагчийн repo-д түүний хувийн түлхүүр secret болж
// орно. Эрх цуцлах = core дээрх ТЭР НЭГ deploy key-г устгах.

export interface DeployKey {
  id: number;
  title: string;
  readOnly: boolean;
  createdAt: string;
}

export async function listDeployKeys(fullName: string): Promise<DeployKey[]> {
  const rows = await gh<{ id: number; title: string; read_only: boolean; created_at: string }[]>(
    `/repos/${fullName}/keys?per_page=100`
  );
  return rows.map((k) => ({ id: k.id, title: k.title, readOnly: k.read_only, createdAt: k.created_at }));
}

export async function addDeployKey(
  fullName: string,
  title: string,
  publicKey: string,
  opts: { readOnly?: boolean } = {}
): Promise<DeployKey> {
  const k = await gh<{ id: number; title: string; read_only: boolean; created_at: string }>(
    `/repos/${fullName}/keys`,
    { method: "POST", body: JSON.stringify({ title, key: publicKey, read_only: opts.readOnly !== false }) }
  );
  return { id: k.id, title: k.title, readOnly: k.read_only, createdAt: k.created_at };
}

/** Байхгүй бол чимээгүй өнгөрнө (идемпотент — цуцлалтыг давтаж болно). */
export async function deleteDeployKey(fullName: string, keyId: number): Promise<void> {
  try {
    await gh<void>(`/repos/${fullName}/keys/${keyId}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
}

/** Actions secret тавина — утга нь repo-ийн нийтийн түлхүүрээр sealed box болно. */
export async function setRepoSecret(fullName: string, name: string, value: string): Promise<void> {
  const pk = await gh<{ key_id: string; key: string }>(`/repos/${fullName}/actions/secrets/public-key`);
  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL));
  await gh<void>(`/repos/${fullName}/actions/secrets/${name}`, {
    method: "PUT",
    body: JSON.stringify({
      encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL),
      key_id: pk.key_id,
    }),
  });
}

export async function deleteRepoSecret(fullName: string, name: string): Promise<void> {
  try {
    await gh<void>(`/repos/${fullName}/actions/secrets/${name}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
}

export async function hasRepoSecret(fullName: string, name: string): Promise<boolean> {
  try {
    await gh<unknown>(`/repos/${fullName}/actions/secrets/${name}`);
    return true;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return false;
    throw error;
  }
}

/** Repo-г бүрмөсөн устгана — classic token-д `delete_repo` scope шаардана. */
export async function deleteRepo(fullName: string): Promise<void> {
  await gh<void>(`/repos/${fullName}`, { method: "DELETE" });
}

export async function listCollaborators(fullName: string): Promise<Collaborator[]> {
  const [members, invites] = await Promise.all([
    gh<{ login: string; html_url: string; role_name?: string; permissions?: Record<string, boolean> }[]>(
      `/repos/${fullName}/collaborators?per_page=100`
    ),
    gh<{ invitee: { login: string; html_url: string }; permissions: string }[]>(
      `/repos/${fullName}/invitations?per_page=100`
    ),
  ]);
  return [
    ...members.map((m) => ({
      login: m.login,
      htmlUrl: m.html_url,
      permission: m.role_name ?? (m.permissions?.admin ? "admin" : m.permissions?.push ? "write" : "read"),
    })),
    ...invites.map((i) => ({
      login: i.invitee.login,
      htmlUrl: i.invitee.html_url,
      permission: i.permissions,
      pending: true,
    })),
  ];
}

export async function inviteCollaborator(
  fullName: string,
  username: string,
  permission: "pull" | "push" | "admin" = "push"
): Promise<void> {
  await gh(`/repos/${fullName}/collaborators/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify({ permission }),
  });
}

// ── Workflow ───────────────────────────────────────────────────────────────

interface RawRun {
  id: number;
  name: string;
  display_title: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  head_branch: string;
}

function toRun(r: RawRun): WorkflowRun {
  return {
    id: r.id,
    name: r.name,
    displayTitle: r.display_title,
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    headBranch: r.head_branch,
  };
}

export async function listWorkflowRuns(
  fullName: string,
  workflowFile: string,
  limit = 5
): Promise<WorkflowRun[]> {
  try {
    const data = await gh<{ workflow_runs: RawRun[] }>(
      `/repos/${fullName}/actions/workflows/${workflowFile}/runs?per_page=${limit}`
    );
    return data.workflow_runs.map(toRun);
  } catch (error) {
    // Workflow файл байхгүй (хуучин seed) — хоосон жагсаалт.
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

export interface RepoFile {
  /** base64-гүй, задлагдсан агуулга */
  content: string;
  sha: string;
}

export async function getFile(fullName: string, path: string, ref?: string): Promise<RepoFile | null> {
  try {
    const f = await gh<{ content: string; encoding: string; sha: string }>(
      `/repos/${fullName}/contents/${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`
    );
    return { content: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export interface ActionsPermissions {
  defaultWorkflowPermissions: string;
  canApprovePullRequestReviews: boolean;
}

export async function getActionsPermissions(fullName: string): Promise<ActionsPermissions> {
  const p = await gh<{ default_workflow_permissions: string; can_approve_pull_request_reviews: boolean }>(
    `/repos/${fullName}/actions/permissions/workflow`
  );
  return {
    defaultWorkflowPermissions: p.default_workflow_permissions,
    canApprovePullRequestReviews: p.can_approve_pull_request_reviews,
  };
}

/**
 * Actions-ийн эрхийг write + «PR үүсгэх» болгоно. Org-ийн бодлого хориглосон бол
 * эхлээд org түвшинд нээгээд дахин оролдоно (token-д admin:org хэрэгтэй).
 * Үүнгүйгээр upstream-sync нь PR нээх гэхэд «Resource not accessible by
 * integration (createPullRequest)» гэж унана.
 */
export async function getOrgActionsPermissions(owner: string): Promise<ActionsPermissions> {
  const p = await gh<{ default_workflow_permissions: string; can_approve_pull_request_reviews: boolean }>(
    `/orgs/${owner}/actions/permissions/workflow`
  );
  return {
    defaultWorkflowPermissions: p.default_workflow_permissions,
    canApprovePullRequestReviews: p.can_approve_pull_request_reviews,
  };
}

export async function ensureActionsPermissions(fullName: string, owner: string): Promise<string> {
  const body = JSON.stringify({ default_workflow_permissions: "write", can_approve_pull_request_reviews: true });
  const done: string[] = [];

  // ORG түвшин эхэлж: org-ийн бодлого нь repo-ийн тохиргоог ДАРНА. Repo дээр
  // «PR үүсгэж болно» гэж харагдаж байсан ч org хориглосон бол Actions
  // «Resource not accessible by integration (createPullRequest)» гэж унана.
  try {
    const org = await gh<{ default_workflow_permissions: string; can_approve_pull_request_reviews: boolean }>(
      `/orgs/${owner}/actions/permissions/workflow`
    );
    if (org.default_workflow_permissions !== "write" || !org.can_approve_pull_request_reviews) {
      await gh<void>(`/orgs/${owner}/actions/permissions/workflow`, { method: "PUT", body });
      done.push("org");
    }
  } catch (error) {
    // Хувь хүний бүртгэл дээр org байхгүй (404) — энэ нь алдаа биш
    if (!(error instanceof GitHubError && (error.status === 404 || error.status === 403))) throw error;
  }

  const repo = await getActionsPermissions(fullName).catch(() => null);
  if (repo?.defaultWorkflowPermissions !== "write" || !repo.canApprovePullRequestReviews) {
    await gh<void>(`/repos/${fullName}/actions/permissions/workflow`, { method: "PUT", body });
    done.push("repo");
  }
  return done.length ? done.join("+") : "already";
}

/** Хавтасны файлуудыг жагсаана (хавтас байхгүй бол хоосон). */
export async function listDir(fullName: string, path: string, ref?: string): Promise<{ name: string; path: string }[]> {
  try {
    const rows = await gh<{ name: string; path: string; type: string }[]>(
      `/repos/${fullName}/contents/${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`
    );
    return Array.isArray(rows) ? rows.filter((r) => r.type === "file").map((r) => ({ name: r.name, path: r.path })) : [];
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

/** Файл бичих/шинэчлэх. `.github/workflows/` бичихэд token-д `workflow` scope хэрэгтэй. */
export async function putFile(
  fullName: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  await gh<void>(`/repos/${fullName}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
}

/** Ажлын логийн сүүл — алдааны яг мөрийг харах (зөвхөн оношлогоонд). */
export async function getJobLogHead(fullName: string, jobId: number, lines = 60): Promise<string> {
  const raw = await getJobLogRaw(fullName, jobId);
  return raw.split("\n").filter((l) => l.trim()).slice(0, lines).join("\n");
}

async function getJobLogRaw(fullName: string, jobId: number): Promise<string> {
  const response = await fetch(`${API}/repos/${fullName}/actions/jobs/${jobId}/logs`, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubError(response.status, `Лог уншиж чадсангүй: ${response.status}`);
  return response.text();
}

export async function getJobLogTail(fullName: string, jobId: number, lines = 25): Promise<string> {
  const response = await fetch(`${API}/repos/${fullName}/actions/jobs/${jobId}/logs`, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubError(response.status, `Лог уншиж чадсангүй: ${response.status}`);
  const text = await response.text();
  const all = text.split("\n").filter((l) => l.trim());
  // Логийн сүүл нь ихэвчлэн post-job цэвэрлэгээ байдаг тул алдааны МӨРҮҮДИЙГ
  // эрэлхийлж, тэдгээрийн эргэн тойрныг харуулна.
  const marks = all
    .map((l, i) => (/##\[error\]|fatal:|error:|!\s\[remote rejected\]|HTTP 4\d\d|HTTP 5\d\d/i.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (marks.length) {
    const from = Math.max(0, marks[0] - 12);
    const to = Math.min(all.length, marks[marks.length - 1] + 3);
    return all.slice(from, to).slice(-lines).join("\n");
  }
  return all.slice(-lines).join("\n");
}

export interface RunStep {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface RunJob {
  id: number;
  name: string;
  conclusion: string | null;
  htmlUrl: string;
  steps: RunStep[];
}

/** Ажиллагааны алхмууд — sync яагаад унасныг лог татахгүйгээр олоход. */
export async function listRunJobs(fullName: string, runId: number): Promise<RunJob[]> {
  const r = await gh<{
    jobs: { id: number; name: string; conclusion: string | null; html_url: string; steps?: { name: string; status: string; conclusion: string | null }[] }[];
  }>(`/repos/${fullName}/actions/runs/${runId}/jobs`);
  return r.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    conclusion: j.conclusion,
    htmlUrl: j.html_url,
    steps: (j.steps ?? []).map((st) => ({ name: st.name, status: st.status, conclusion: st.conclusion })),
  }));
}

export async function dispatchWorkflow(
  fullName: string,
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>
): Promise<void> {
  await gh(`/repos/${fullName}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref, inputs }),
  });
}

export interface PullInfo {
  number: number;
  title: string;
  htmlUrl: string;
  headRef: string;
  headSha: string;
  labels: string[];
  mergeable: boolean | null;
  mergeableState: string;
}

export async function getPull(fullName: string, number: number): Promise<PullInfo> {
  const p = await gh<{ number: number; title: string; html_url: string; head: { ref: string; sha: string }; labels: { name: string }[]; mergeable: boolean | null; mergeable_state: string }>(`/repos/${fullName}/pulls/${number}`);
  return { number: p.number, title: p.title, htmlUrl: p.html_url, headRef: p.head.ref, headSha: p.head.sha, labels: p.labels.map((l) => l.name), mergeable: p.mergeable, mergeableState: p.mergeable_state };
}

/** Нээлттэй upstream-sync PR-ууд (head `upstream-sync/*`). */
export async function listOpenSyncPulls(fullName: string): Promise<PullInfo[]> {
  const list = await gh<{ number: number; title: string; html_url: string; head: { ref: string; sha: string }; labels: { name: string }[] }[]>(`/repos/${fullName}/pulls?state=open&per_page=20`);
  return list
    .filter((p) => p.head.ref.startsWith("upstream-sync/"))
    .map((p) => ({ number: p.number, title: p.title, htmlUrl: p.html_url, headRef: p.head.ref, headSha: p.head.sha, labels: p.labels.map((l) => l.name), mergeable: null, mergeableState: "unknown" }));
}

export async function mergePull(fullName: string, number: number, title: string): Promise<void> {
  await gh<void>(`/repos/${fullName}/pulls/${number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "merge", commit_title: title }) });
}

export async function listOpenPulls(fullName: string): Promise<{ title: string; htmlUrl: string; number: number }[]> {
  const pulls = await gh<{ title: string; html_url: string; number: number }[]>(
    `/repos/${fullName}/pulls?state=open&per_page=20`
  );
  return pulls.map((p) => ({ title: p.title, htmlUrl: p.html_url, number: p.number }));
}

// ── Core ───────────────────────────────────────────────────────────────────

export async function getLatestRelease(): Promise<Release | null> {
  try {
    const r = await gh<{ tag_name: string; html_url: string; published_at: string | null }>(
      `/repos/${config.coreRepo}/releases/latest`
    );
    return { tagName: r.tag_name, htmlUrl: r.html_url, publishedAt: r.published_at };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export async function getDefaultBranch(fullName: string): Promise<string> {
  const r = await gh<{ default_branch: string }>(`/repos/${fullName}`);
  return r.default_branch;
}

// ── Deploy-ийн health (харилцагчийн app) ───────────────────────────────────

export interface Health {
  ok: boolean;
  version: string | null;
  sha: string | null;
  error?: string;
}

export async function fetchHealth(appUrl: string | null): Promise<Health | null> {
  if (!appUrl) return null;
  try {
    const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const data = (await response.json()) as { ok?: boolean; version?: string; sha?: string; error?: string };
    return {
      ok: Boolean(data.ok),
      version: data.version ?? null,
      sha: data.sha ?? null,
      error: data.error,
    };
  } catch (error) {
    return { ok: false, version: null, sha: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Тохиргооны шалгалт (/settings) ─────────────────────────────────────────

export interface TokenInfo {
  login: string;
  /** Classic token-ийн scope-ууд (fine-grained бол хоосон) */
  scopes: string[];
  tokenType: "classic" | "fine-grained" | "unknown";
}

export async function getTokenInfo(): Promise<TokenInfo> {
  const response = await fetch(`${API}/user`, {
    headers: { Authorization: `Bearer ${config.githubToken}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubError(response.status, `GitHub ${response.status}: token хүчингүй`);
  const user = (await response.json()) as { login: string };
  const scopes = (response.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const token = config.githubToken;
  const tokenType = token.startsWith("ghp_") ? "classic" : token.startsWith("github_pat_") ? "fine-grained" : "unknown";
  return { login: user.login, scopes, tokenType };
}

/** Repo эзэн (org/user)-д хандаж чадах эсэх — repo үүсгэх урьдчилсан шалгалт. */
export async function checkOwnerAccess(login: string): Promise<{ ok: boolean; detail: string }> {
  try {
    if (config.ownerType === "org") {
      const org = await gh<{ login: string }>(`/orgs/${config.owner}`);
      const membership = await gh<{ role: string; state: string }>(
        `/orgs/${config.owner}/memberships/${encodeURIComponent(login)}`
      );
      return { ok: membership.role === "admin", detail: `${org.login} — ${membership.role} (${membership.state})` };
    }
    // Хэрэглэгчийн акаунт: token яг тэр хэрэглэгчийнх байх ёстой (repo үүсгэх, /user/repos)
    const ok = login.toLowerCase() === config.owner.toLowerCase();
    return { ok, detail: ok ? `token @${login}-ийнх — repo эзэнтэй таарна` : `token @${login}-ийнх, харин GITHUB_OWNER=${config.owner}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Core repo-ийн Actions secret нэрс (утга харагдахгүй) ба variable-ууд. */
export async function getCoreActionsConfig(): Promise<{
  secrets: string[];
  variables: Record<string, string>;
  error?: string;
}> {
  try {
    const [s, v] = await Promise.all([
      gh<{ secrets: { name: string }[] }>(`/repos/${config.coreRepo}/actions/secrets?per_page=100`),
      gh<{ variables: { name: string; value: string }[] }>(`/repos/${config.coreRepo}/actions/variables?per_page=100`),
    ]);
    return {
      secrets: s.secrets.map((x) => x.name),
      variables: Object.fromEntries(v.variables.map((x) => [x.name, x.value])),
    };
  } catch (error) {
    return { secrets: [], variables: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Зөвхөн 404 → false; эрх/сүлжээний алдаа дуудагч руу шидэгдэнэ. */
export async function coreWorkflowExists(file: string): Promise<boolean> {
  try {
    await gh(`/repos/${config.coreRepo}/actions/workflows/${file}`);
    return true;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return false;
    throw error;
  }
}
