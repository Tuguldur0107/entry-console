// Харилцагчийг БҮРЭН устгах: Railway app + Postgres service (volume-тэй),
// GitHub repo, console бүртгэл. Алхам бүр тусдаа — унасан алхмыг тэмдэглээд
// бусдыг үргэлжлүүлнэ; бүгд амжилттай бол л DB мөр устана, үгүй бол мөр
// «устгал дутуу» тэмдэглэлтэй үлдэж дахин оролдож болно.
import { eq } from "drizzle-orm";

import { logEvent } from "./customers";
import { db } from "./db";
import { customers, type Customer } from "./db/schema";
import { deleteRepo, getCustomerRepo, GitHubError } from "./github";
import { deleteCustomDomain, deleteService, railwayCanConnectRepo, railwayConfigured } from "./railway";
import { revokeUpstreamAccess } from "./upstream-access";

export class TeardownError extends Error {
  constructor(message: string, public readonly failed: string[]) {
    super(message);
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface TeardownPlan {
  railwayApp: boolean;
  railwayDb: boolean;
  githubRepo: boolean;
  /** Устгал хийж чадахгүй шалтгаанууд (UI-д анхааруулга) */
  warnings: string[];
}

/** Юу устах вэ — UI-д урьдчилан харуулна. */
export async function teardownPlan(customer: Customer, repoExists: boolean): Promise<TeardownPlan> {
  const warnings: string[] = [];
  const railwayApp = !!customer.railwayServiceId;
  const railwayDb = !!customer.railwayPostgresServiceId;
  if ((railwayApp || railwayDb) && (!railwayConfigured() || !railwayCanConnectRepo()))
    warnings.push("Railway service устгахад RAILWAY_TOKEN (account token) хэрэгтэй — одоо тохируулаагүй тул Railway дээр гараар устгана");
  return { railwayApp, railwayDb, githubRepo: repoExists, warnings };
}

/**
 * Бүх нөөцийг устгана. Амжилттай бол DB мөр устаж `true` буцаана;
 * аль нэг алхам унавал TeardownError (failed жагсаалттай) — мөр хэвээр.
 */
export async function destroyCustomer(customer: Customer): Promise<void> {
  const failed: string[] = [];
  const done: string[] = [];
  let next: Partial<typeof customers.$inferInsert> = {};

  // 0a. Core repo дээрх энэ харилцагчийн deploy key (repo устсан ч core дээр
  //     үлдэж болзошгүй тул эхэлж цэвэрлэнэ)
  try {
    await revokeUpstreamAccess(customer, "харилцагч устгагдав");
    done.push("шинэчлэлтийн эрх");
  } catch {
    /* устгалыг үүнээс болж зогсоохгүй */
  }

  // 0. Custom domain (service устахад хамт устдаг ч ил устгана)
  if (customer.customDomainId) {
    try {
      await deleteCustomDomain(customer.customDomainId);
      done.push(`domain ${customer.customDomain}`);
      next = { ...next, customDomainId: null, customDomain: null, dnsTarget: null, customDomainVerified: false };
    } catch {
      /* service-тэй хамт устана */
    }
  }
  // 1. Railway app service
  if (customer.railwayServiceId && customer.railwayProjectId && customer.railwayEnvironmentId) {
    try {
      await deleteService(customer.railwayProjectId, customer.railwayEnvironmentId!, customer.railwayServiceId);
      done.push(`Railway service entry-${customer.slug}`);
      next = { ...next, railwayServiceId: null, railwayRepoConnected: false, appUrl: null };
    } catch (error) {
      failed.push(`Railway app: ${msg(error)}`);
    }
  }
  // 2. Railway Postgres (+ volume)
  if (customer.railwayPostgresServiceId && customer.railwayProjectId && customer.railwayEnvironmentId) {
    try {
      await deleteService(customer.railwayProjectId, customer.railwayEnvironmentId!, customer.railwayPostgresServiceId);
      done.push(`Railway Postgres entry-${customer.slug}-db`);
      next = { ...next, railwayPostgresServiceId: null };
    } catch (error) {
      failed.push(`Railway DB: ${msg(error)}`);
    }
  }
  // 3. GitHub repo (байхгүй бол алгасна)
  try {
    const repo = await getCustomerRepo(customer.slug);
    if (repo) {
      await deleteRepo(repo.fullName);
      done.push(`GitHub repo ${repo.fullName}`);
    }
  } catch (error) {
    if (error instanceof GitHubError && error.status === 403)
      failed.push(`GitHub repo: ${msg(error)} — token-д \`delete_repo\` scope нэм (Tokens (classic) → Update)`);
    else failed.push(`GitHub repo: ${msg(error)}`);
  }

  if (failed.length > 0) {
    // Устсан хэсгийг DB-д тусгаж, дутууг тэмдэглээд мөрийг үлдээнэ (дахин оролдоно)
    await db
      .update(customers)
      .set({ ...next, deployError: `Устгал дутуу: ${failed.join("; ")}`, status: "archived", updatedAt: new Date() })
      .where(eq(customers.id, customer.id));
    await logEvent(customer.id, "status", `Устгал дутуу — устсан: ${done.join(", ") || "—"}; алдаа: ${failed.join("; ")}`);
    throw new TeardownError(`Дутуу устлаа. Устсан: ${done.join(", ") || "—"}. Алдаа: ${failed.join("; ")}`, failed);
  }
  // 4. Console бүртгэл (events cascade)
  await db.delete(customers).where(eq(customers.id, customer.id));
}
