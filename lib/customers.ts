// Харилцагчийн нэгтгэсэн төлөв — GitHub + харилцагчийн app-ийн /api/health.
import { config } from "./config";
import {
  fetchHealth,
  getLatestRelease,
  getVariable,
  listCollaborators,
  listCustomerRepos,
  listOpenPulls,
  listWorkflowRuns,
  type Collaborator,
  type CustomerRepo,
  type Health,
  type Release,
  type WorkflowRun,
} from "./github";

export interface CustomerSummary {
  repo: CustomerRepo;
  displayName: string;
  appUrl: string | null;
  seededRef: string | null;
  health: Health | null;
  lastSync: WorkflowRun | null;
  /** Core-ийн сүүлийн release-ээс хоцорсон эсэх (health.version-оор). */
  behind: boolean | null;
}

export interface CustomerDetail extends CustomerSummary {
  collaborators: Collaborator[];
  syncRuns: WorkflowRun[];
  openPulls: { title: string; htmlUrl: string; number: number }[];
}

function normalizeVersion(v: string | null): string | null {
  return v ? v.replace(/^v/, "") : null;
}

export function isBehind(health: Health | null, latest: Release | null): boolean | null {
  const current = normalizeVersion(health?.version ?? null);
  const target = normalizeVersion(latest?.tagName ?? null);
  if (!current || !target) return null;
  return current !== target;
}

async function summarize(repo: CustomerRepo, latest: Release | null): Promise<CustomerSummary> {
  const [displayName, appUrl, seededRef, syncRuns] = await Promise.all([
    getVariable(repo.fullName, "ENTRY_DISPLAY_NAME"),
    getVariable(repo.fullName, "ENTRY_APP_URL"),
    getVariable(repo.fullName, "ENTRY_SEEDED_REF"),
    listWorkflowRuns(repo.fullName, "upstream-sync.yml", 1),
  ]);
  const health = await fetchHealth(appUrl);
  return {
    repo,
    displayName: displayName ?? repo.description?.replace(/^Entry Accounting — /, "") ?? repo.slug,
    appUrl,
    seededRef,
    health,
    lastSync: syncRuns[0] ?? null,
    behind: isBehind(health, latest),
  };
}

export async function loadDashboard(): Promise<{
  latest: Release | null;
  customers: CustomerSummary[];
  provisioning: WorkflowRun[];
}> {
  const [latest, repos, provisionRuns] = await Promise.all([
    getLatestRelease(),
    listCustomerRepos(),
    listWorkflowRuns(config.coreRepo, "provision-customer.yml", 10),
  ]);
  const customers = await Promise.all(repos.map((repo) => summarize(repo, latest)));
  // Дуусаагүй (queued / in_progress) provision run-ууд — "үүсгэж байна" мөр.
  const provisioning = provisionRuns.filter((r) => r.status !== "completed");
  return { latest, customers, provisioning };
}

export async function loadCustomerDetail(
  repo: CustomerRepo
): Promise<{ latest: Release | null; customer: CustomerDetail }> {
  const latest = await getLatestRelease();
  const [summary, collaborators, syncRuns, openPulls] = await Promise.all([
    summarize(repo, latest),
    listCollaborators(repo.fullName),
    listWorkflowRuns(repo.fullName, "upstream-sync.yml", 5),
    listOpenPulls(repo.fullName),
  ]);
  return { latest, customer: { ...summary, collaborators, syncRuns, openPulls } };
}
