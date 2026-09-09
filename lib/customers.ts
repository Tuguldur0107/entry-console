// Харилцагчийн нэгтгэсэн төлөв: DB (бизнесийн бүртгэл) + GitHub (repo,
// sync run) + харилцагчийн app-ийн /api/health.
import { desc, eq } from "drizzle-orm";

import { config } from "./config";
import { db } from "./db";
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
 *  - DB-д байхгүй `entry-customer` repo (гараар/Actions-оор үүссэн) → бүртгэнэ
 */
async function reconcile(rows: Customer[], repos: CustomerRepo[]): Promise<Customer[]> {
  const byRepo = new Map(repos.map((r) => [r.fullName.toLowerCase(), r]));
  const updated: Customer[] = [];
  for (const row of rows) {
    const repo = byRepo.get(row.githubRepo.toLowerCase());
    if (repo && row.status === "provisioning") {
      const [next] = await db
        .update(customers)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(customers.id, row.id))
        .returning();
      await logEvent(row.id, "activated", `Repo үүслээ: ${repo.fullName}`);
      updated.push(next);
    } else updated.push(row);
  }
  const known = new Set(rows.map((r) => r.githubRepo.toLowerCase()));
  for (const repo of repos) {
    if (known.has(repo.fullName.toLowerCase())) continue;
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
  const row = await db.query.customers.findFirst({ where: eq(customers.slug, slug) });
  return row ?? null;
}

export async function loadCustomerDetail(
  customer: Customer
): Promise<{ latest: Release | null; customer: CustomerDetail }> {
  const [latest, repos] = await Promise.all([getLatestRelease(), listCustomerRepos()]);
  const repo = repos.find((r) => r.fullName.toLowerCase() === customer.githubRepo.toLowerCase()) ?? null;
  const [reconciled] = await reconcile([customer], repo ? [repo] : []);
  const [summary, collaborators, syncRuns, openPulls, events, provisionRuns] = await Promise.all([
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
  ]);
  const provisionRun =
    provisionRuns.find((r) => r.displayTitle.endsWith(`: ${customer.slug}`)) ?? null;
  return {
    latest,
    customer: { ...summary, collaborators, syncRuns, openPulls, events, provisionRun },
  };
}
