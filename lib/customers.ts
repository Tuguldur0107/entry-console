// Харилцагчийн нэгтгэсэн төлөв: DB (бизнесийн бүртгэл) + GitHub (repo,
// sync run) + харилцагчийн app-ийн /api/health.
import { desc, eq } from "drizzle-orm";

import { config } from "./config";
import { db } from "./db";
import { ensureSchema } from "./db/ensure";
import { customerEvents, customers, type Customer, type CustomerEvent } from "./db/schema";
import {
  fetchHealth,
  getLatestRelease,
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
import { deployNow, syncRepoConnections } from "./deploy";
import { latestDeployment, railwayCanConnectRepo, railwayConfigured, type RailwayStatus } from "./railway";

export interface CustomerSummary {
  customer: Customer;
  repo: CustomerRepo | null;
  health: Health | null;
  lastSync: WorkflowRun | null;
  /** Core-ийн сүүлийн release-ээс хоцорсон эсэх (health.version-оор). */
  behind: boolean | null;
}

export interface CustomerDetail extends CustomerSummary {
  collaborators: Collaborator[];
  syncRuns: WorkflowRun[];
  openPulls: { title: string; htmlUrl: string; number: number }[];
  events: CustomerEvent[];
  /** Repo хараахан үүсээгүй үед — core дээрх provision run */
  provisionRun: WorkflowRun | null;
  /** Railway дээрх сүүлийн deployment (service бүртгэлтэй үед) */
  railway: RailwayStatus | null;
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

export async function logEvent(customerId: string, type: string, message: string): Promise<void> {
  await db.insert(customerEvents).values({ customerId, type, message });
}

/**
 * DB ба GitHub-ийг тааруулна:
 *  - provisioning төлөвтэй харилцагчийн repo үүссэн бол → active
 *    (autoDeploy бол тэр дороо Railway deploy — алдаа deployError-д үлдэнэ)
 *  - DB-д байхгүй `entry-customer` repo (гараар/Actions-оор үүссэн) → бүртгэнэ
 */
async function reconcile(rows: Customer[], repos: CustomerRepo[]): Promise<Customer[]> {
  const byRepo = new Map(repos.map((r) => [r.fullName.toLowerCase(), r]));
  const updated: Customer[] = [];
  for (const row of await syncRepoConnections(rows)) {
    const repo = byRepo.get(row.githubRepo.toLowerCase());
    // pushedAt байхгүй = хоосон repo (seed амжаагүй) — идэвхтэй гэж тооцохгүй.
    if (repo && repo.pushedAt && row.status === "provisioning") {
      const [next] = await db
        .update(customers)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(customers.id, row.id))
        .returning();
      await logEvent(row.id, "activated", `Repo үүслээ: ${repo.fullName}`);
      updated.push(await maybeAutoDeploy(next));
    } else if (repo?.pushedAt && row.autoDeploy && (!row.railwayServiceId ? !row.deployError : !row.railwayRepoConnected && railwayCanConnectRepo())) {
      // Идэвхтэй болсон ч deploy хийгдээгүй (Railway хожим тохируулагдсан), эсвэл service бэлэн
      // боловч repo холбогдоогүй байтал account token нэмэгдсэн → холбоно
      updated.push(await maybeAutoDeploy(row));
    } else updated.push(row);
  }
  const known = new Set(rows.map((r) => r.githubRepo.toLowerCase()));
  for (const repo of repos) {
    if (known.has(repo.fullName.toLowerCase()) || !repo.pushedAt) continue;
    const [created] = await db
      .insert(customers)
      .values({
        slug: repo.slug,
        displayName: repo.description?.replace(/^Entry Accounting — /, "") || repo.slug,
        githubRepo: repo.fullName,
        status: "active",
      })
      .onConflictDoNothing({ target: customers.slug })
      .returning();
    if (created) {
      await logEvent(created.id, "provisioned", `GitHub-аас бүртгэв: ${repo.fullName}`);
      updated.push(created);
    }
  }
  return updated;
}

/** autoDeploy + Railway тохируулсан + deploy хийгдээгүй бол deploy; алдааг залгина (deployError-д). */
async function maybeAutoDeploy(row: Customer): Promise<Customer> {
  if (!row.autoDeploy || !railwayConfigured() || (row.railwayServiceId && row.railwayRepoConnected)) return row;
  try {
    return await deployNow(row, true);
  } catch {
    const again = await db.query.customers.findFirst({ where: eq(customers.id, row.id) });
    return again ?? row;
  }
}

async function summarize(
  customer: Customer,
  repo: CustomerRepo | null,
  latest: Release | null
): Promise<CustomerSummary> {
  const [syncRuns, health] = await Promise.all([
    repo ? listWorkflowRuns(repo.fullName, "upstream-sync.yml", 1).catch(() => []) : Promise.resolve([]),
    fetchHealth(customer.appUrl),
  ]);
  return {
    customer,
    repo,
    health,
    lastSync: syncRuns[0] ?? null,
    behind: isBehind(health, latest),
  };
}

/** GitHub дуудлага унавал (token эрх, сүлжээ) самбар унахгүй — алдааг буцаана. */
async function safe<T>(fallback: T, fn: () => Promise<T>, errors: string[]): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

export async function loadDashboard(): Promise<{
  latest: Release | null;
  customers: CustomerSummary[];
  provisioning: WorkflowRun[];
  /** GitHub талын алдаанууд — UI дээр banner */
  githubErrors: string[];
}> {
  const githubErrors: string[] = [];
  await ensureSchema();
  const [latest, rows, repos, provisionRuns] = await Promise.all([
    safe<Release | null>(null, getLatestRelease, githubErrors),
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    safe<CustomerRepo[]>([], listCustomerRepos, githubErrors),
    safe<WorkflowRun[]>([], () => listWorkflowRuns(config.coreRepo, "provision-customer.yml", 10), githubErrors),
  ]);
  // GitHub repo жагсаалт авч чадаагүй бол reconcile хийхгүй (буруугаар "үүсээгүй" гэж дүгнэхгүй).
  const reconciled = githubErrors.length > 0 ? rows : await reconcile(rows, repos);
  const byRepo = new Map(repos.map((r) => [r.fullName.toLowerCase(), r]));
  const summaries = await Promise.all(
    reconciled.map((c) => summarize(c, byRepo.get(c.githubRepo.toLowerCase()) ?? null, latest))
  );
  summaries.sort((a, b) => b.customer.createdAt.getTime() - a.customer.createdAt.getTime());
  return {
    latest,
    customers: summaries,
    provisioning: provisionRuns.filter((r) => r.status !== "completed"),
    githubErrors: Array.from(new Set(githubErrors)),
  };
}

export async function getCustomerBySlug(slug: string): Promise<Customer | null> {
  await ensureSchema();
  const row = await db.query.customers.findFirst({ where: eq(customers.slug, slug) });
  return row ?? null;
}

export async function loadCustomerDetail(
  customer: Customer
): Promise<{ latest: Release | null; customer: CustomerDetail }> {
  const [latest, repos] = await Promise.all([getLatestRelease(), listCustomerRepos()]);
  const repo = repos.find((r) => r.fullName.toLowerCase() === customer.githubRepo.toLowerCase()) ?? null;
  const [reconciled] = await reconcile([customer], repo ? [repo] : []);
  const [summary, collaborators, syncRuns, openPulls, events, provisionRuns, railway] = await Promise.all([
    summarize(reconciled, repo, latest),
    repo ? listCollaborators(repo.fullName) : Promise.resolve([]),
    repo ? listWorkflowRuns(repo.fullName, "upstream-sync.yml", 5) : Promise.resolve([]),
    repo ? listOpenPulls(repo.fullName) : Promise.resolve([]),
    db
      .select()
      .from(customerEvents)
      .where(eq(customerEvents.customerId, customer.id))
      .orderBy(desc(customerEvents.createdAt))
      .limit(20),
    repo ? Promise.resolve([]) : listWorkflowRuns(config.coreRepo, "provision-customer.yml", 10),
    reconciled.railwayServiceId && reconciled.railwayProjectId && reconciled.railwayEnvironmentId && railwayConfigured()
      ? latestDeployment(reconciled.railwayProjectId, reconciled.railwayEnvironmentId, reconciled.railwayServiceId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const provisionRun =
    provisionRuns.find((r) => r.displayTitle.endsWith(`: ${customer.slug}`)) ?? null;
  return {
    latest,
    customer: { ...summary, collaborators, syncRuns, openPulls, events, provisionRun, railway },
  };
}


// ── Самбарын нэмэлт: анхаарах зүйлс, сүүлийн үйл явдал ─────────────────────

export interface AttentionItem {
  tone: "danger" | "warning" | "info";
  slug: string;
  title: string;
  detail: string;
}

export function computeAttention(
  items: CustomerSummary[],
  latest: Release | null,
  repoListOk = true
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const { customer: c, repo, health, behind, lastSync } of items) {
    if (repoListOk && c.status === "provisioning" && Date.now() - c.createdAt.getTime() > 10 * 60 * 1000 && !repo)
      out.push({ tone: "danger", slug: c.slug, title: c.displayName, detail: "Repo 10+ минут үүсээгүй — core-ийн PROVISION_TOKEN, workflow run-ыг шалга" });
    if (repoListOk && repo && !repo.pushedAt)
      out.push({ tone: "danger", slug: c.slug, title: c.displayName, detail: "Repo үүссэн ч хоосон — core түүх push хийгдээгүй; provision workflow-г дахин ажиллуул" });
    if (health && !health.ok)
      out.push({ tone: "danger", slug: c.slug, title: c.displayName, detail: `Deploy хүрэхгүй: ${health.error ?? "unknown"}` });
    if (behind)
      out.push({ tone: "warning", slug: c.slug, title: c.displayName, detail: `Хувилбар v${health?.version} — core ${latest?.tagName}. Sync хийх` });
    if (lastSync && lastSync.status === "completed" && lastSync.conclusion !== "success")
      out.push({ tone: "warning", slug: c.slug, title: c.displayName, detail: "Сүүлийн upstream-sync амжилтгүй" });
    if (c.railwayServiceId && !c.railwayRepoConnected)
      out.push({ tone: "warning", slug: c.slug, title: c.displayName, detail: "Railway service бэлэн, GitHub repo холбогдоогүй — build эхлээгүй" });
    else if (c.deployError)
      out.push({ tone: "danger", slug: c.slug, title: c.displayName, detail: `Railway deploy амжилтгүй: ${c.deployError.slice(0, 120)}` });
    if (c.status === "active" && !c.appUrl)
      out.push({ tone: "info", slug: c.slug, title: c.displayName, detail: c.railwayServiceId ? "Deploy хаяг алга" : "Deploy хийгдээгүй — харилцагчийн хуудаснаас «Railway-д deploy» дарна" });
  }
  return out;
}

export interface ActivityItem extends CustomerEvent {
  slug: string;
  displayName: string;
}

export async function loadRecentActivity(limit = 12): Promise<ActivityItem[]> {
  await ensureSchema();
  const rows = await db
    .select({
      id: customerEvents.id,
      customerId: customerEvents.customerId,
      type: customerEvents.type,
      message: customerEvents.message,
      createdAt: customerEvents.createdAt,
      slug: customers.slug,
      displayName: customers.displayName,
    })
    .from(customerEvents)
    .innerJoin(customers, eq(customers.id, customerEvents.customerId))
    .orderBy(desc(customerEvents.createdAt))
    .limit(limit);
  return rows;
}

export function filterCustomers(
  items: CustomerSummary[],
  q: string | undefined,
  status: string | undefined
): CustomerSummary[] {
  const needle = (q ?? "").trim().toLowerCase();
  return items.filter(({ customer: c }) => {
    if (status && status !== "all" && c.status !== status) return false;
    if (!needle) return true;
    return [c.displayName, c.slug, c.registerNo, c.contactName, c.contactEmail, c.githubRepo]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  });
}
