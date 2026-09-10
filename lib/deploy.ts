// Харилцагчийг Railway-д deploy хийх ЦӨМ — server action (товч) ба reconcile
// (autoDeploy: repo бэлэн болмогц) хоёулаа энийг дуудна.
//   Урсгал: railway.ts deployCustomer → id-уудыг DB-д → appUrl = https://<domain>
//   → түүхэнд бичнэ. Алдаа → deployError-д хадгалагдана (самбарт анхааруулна).
import { eq } from "drizzle-orm";

import { logEvent } from "./customers";
import { db } from "./db";
import { customers, type Customer } from "./db/schema";
import { config } from "./config";
import {
  connectRepo,
  createCustomDomain,
  DEFAULT_BACKUP_KINDS,
  deployCustomer,
  listProjectServices,
  railwayCanConnectRepo,
  railwayConfigured,
  redeployService,
  setBackupSchedule,
  volumeInstanceForService,
} from "./railway";

export class DeployError extends Error {
  constructor(message: string, public readonly customer?: Customer) {
    super(message);
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Deploy хийж болох эсэх — болохгүй бол шалтгаан. */
export function deployBlocker(customer: Customer, repoSeeded: boolean): string | null {
  if (!railwayConfigured()) return "Railway тохируулаагүй (Тохиргоо → Railway)";
  if (customer.railwayServiceId && customer.railwayRepoConnected) return "Аль хэдийн deploy хийгдсэн — «Дахин deploy» ашигла";
  if (customer.railwayServiceId && !railwayCanConnectRepo())
    return "Service бэлэн, repo холбогдоогүй — RAILWAY_TOKEN (account token) нэмээд дахин оролд, эсвэл Railway дээр гараар холбо";
  if (!repoSeeded) return "Repo хараахан бэлэн биш — core түүх push хийгдсэний дараа deploy болно";
  return null;
}

/** Service бэлэн боловч repo холбогдоогүй үед — Railway дээр гараар хийх заавар. */
export function manualConnectHint(customer: Customer): string {
  return `Railway → service «entry-${customer.slug}» → Settings → Source → Connect Repo → ${customer.githubRepo} (branch main)`;
}

/**
 * Railway дээр service хос үүсгэж deploy эхлүүлнэ. Амжилттай бол Customer
 * (шинэчлэгдсэн) буцаана; алдаа бол deployError-д бичээд DeployError шиднэ.
 */
export async function deployNow(customer: Customer, repoSeeded: boolean): Promise<Customer> {
  const blocker = deployBlocker(customer, repoSeeded);
  if (blocker) throw new DeployError(blocker);
  const steps: string[] = [];
  try {
    // Service бэлэн, зөвхөн repo холболт дутуу (өмнө нь project token-оор үүссэн) → холбоод л болно
    if (customer.railwayServiceId && !customer.railwayRepoConnected) {
      steps.push("GitHub repo холбож байна");
      await connectRepo(customer.railwayServiceId, customer.githubRepo);
      const [next] = await db
        .update(customers)
        .set({ railwayRepoConnected: true, deployError: null, updatedAt: new Date() })
        .where(eq(customers.id, customer.id))
        .returning();
      await logEvent(customer.id, "deploy", `Repo холбогдож deploy эхэллээ → ${customer.appUrl}`);
      return next;
    }

    const result = await deployCustomer(
      { slug: customer.slug, displayName: customer.displayName, githubRepo: customer.githubRepo },
      (step) => steps.push(step)
    );
    const appUrl = `https://${result.domain}`;
    const connectNote = result.connected
      ? null
      : `Service, Postgres, domain бэлэн; repo холбогдоогүй: ${result.connectError}. ${manualConnectHint({ ...customer, appUrl })}`;
    const [next] = await db
      .update(customers)
      .set({
        railwayProjectId: result.projectId,
        railwayEnvironmentId: result.environmentId,
        railwayServiceId: result.appServiceId,
        railwayPostgresServiceId: result.postgresServiceId,
        railwayRepoConnected: result.connected,
        appUrl,
        deployError: connectNote,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id))
      .returning();
    await logEvent(customer.id, "deploy", result.connected ? `Railway deploy эхэллээ → ${appUrl}` : `Railway service үүслээ (${appUrl}), repo холбогдоогүй — ${result.connectError}`);
    // Backup хуваарь + custom domain (алдаа нь deploy-г унагахгүй — хяналт дараа нөхнө)
    const extra = await attachBackupsAndDomain(next).catch(() => ({}));
    const withExtra = { ...next, ...extra } as Customer;
    if (!result.connected) throw new DeployError(connectNote!, withExtra);
    return withExtra;
  } catch (error) {
    if (error instanceof DeployError && error.customer) throw error; // DB аль хэдийн шинэчлэгдсэн
    const detail = `${msg(error)}${steps.length ? ` (алхам: ${steps[steps.length - 1]})` : ""}`;
    await db.update(customers).set({ deployError: detail, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await logEvent(customer.id, "deploy", `Railway deploy амжилтгүй: ${detail}`);
    throw new DeployError(detail);
  }
}

/**
 * Service бэлэн боловч DB-д «repo холбогдоогүй» гэсэн харилцагчдын бодит төлөвийг
 * Railway-аас шалгана — Railway dashboard дээр гараар холбосон бол DB-г засна.
 * Алдаа залгина (самбар унахгүй).
 */
export async function syncRepoConnections(rows: Customer[]): Promise<Customer[]> {
  const pending = rows.filter((r) => r.railwayServiceId && !r.railwayRepoConnected && r.railwayProjectId && r.railwayEnvironmentId);
  if (pending.length === 0 || !railwayConfigured()) return rows;
  const byProject = new Map<string, Promise<Map<string, boolean>>>();
  const out: Customer[] = [];
  for (const row of rows) {
    if (!pending.includes(row)) {
      out.push(row);
      continue;
    }
    const key = `${row.railwayProjectId}:${row.railwayEnvironmentId}`;
    if (!byProject.has(key))
      byProject.set(
        key,
        listProjectServices(row.railwayProjectId!, row.railwayEnvironmentId!)
          .then((list) => new Map(list.map((s) => [s.id, s.connected])))
          .catch(() => new Map<string, boolean>())
      );
    const connected = (await byProject.get(key)!).get(row.railwayServiceId!) === true;
    if (!connected) {
      out.push(row);
      continue;
    }
    const [next] = await db
      .update(customers)
      .set({ railwayRepoConnected: true, deployError: null, updatedAt: new Date() })
      .where(eq(customers.id, row.id))
      .returning();
    await logEvent(row.id, "deploy", `Repo Railway дээр холбогдсон байна → ${row.appUrl} (build явж байна)`);
    out.push(next ?? row);
  }
  return out;
}

/**
 * Postgres volume-д өдөр+7 хоног тутмын backup хуваарь тавьж, CUSTOMER_BASE_DOMAIN
 * тохируулсан бол <slug>.<base> custom domain үүсгэнэ. DB-д хадгалах patch буцаана
 * (дуудагч бичнэ). Аль нэг нь унавал бусдыг үргэлжлүүлж, алдааг шиднэ.
 */
export async function attachBackupsAndDomain(customer: Customer): Promise<Partial<typeof customers.$inferInsert>> {
  const patch: Partial<typeof customers.$inferInsert> = {};
  const errors: string[] = [];
  if (!customer.railwayProjectId || !customer.railwayEnvironmentId) return patch;
  if (customer.railwayPostgresServiceId && !customer.railwayVolumeInstanceId) {
    try {
      const vi = await volumeInstanceForService(customer.railwayProjectId, customer.railwayEnvironmentId, customer.railwayPostgresServiceId);
      if (vi) {
        await setBackupSchedule(vi, DEFAULT_BACKUP_KINDS);
        patch.railwayVolumeInstanceId = vi;
        patch.backupSchedule = DEFAULT_BACKUP_KINDS.join(",");
        await logEvent(customer.id, "deploy", `Backup хуваарь: ${DEFAULT_BACKUP_KINDS.join(", ")} (Railway volume)`);
      }
    } catch (error) {
      errors.push(`backup: ${msg(error)}`);
    }
  }
  if (config.baseDomain && customer.railwayServiceId && !customer.customDomainId) {
    const domain = `${customer.slug}.${config.baseDomain}`;
    try {
      const d = await createCustomDomain(customer.railwayProjectId, customer.railwayEnvironmentId, customer.railwayServiceId, domain);
      const cname = d.dns.find((r) => r.recordType === "CNAME") ?? d.dns[0];
      patch.customDomain = d.domain;
      patch.customDomainId = d.id;
      patch.dnsTarget = cname?.requiredValue ?? null;
      patch.customDomainVerified = d.verified;
      await logEvent(customer.id, "deploy", `Custom domain ${d.domain} үүслээ — DNS: ${cname ? `${cname.recordType} ${cname.hostlabel || d.domain} → ${cname.requiredValue}` : "Railway-с харна"}`);
    } catch (error) {
      errors.push(`domain: ${msg(error)}`);
    }
  }
  if (Object.keys(patch).length > 0)
    await db.update(customers).set({ ...patch, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  if (errors.length > 0) throw new DeployError(errors.join("; "));
  return patch;
}

/** Байгаа service-ийг дахин deploy (сүүлийн commit-оор). Repo холбогдоогүй бол эхлээд холбоно. */
export async function redeployNow(customer: Customer): Promise<void> {
  if (!customer.railwayServiceId || !customer.railwayEnvironmentId)
    throw new DeployError("Railway service бүртгэлгүй — эхлээд deploy хий");
  if (!customer.railwayRepoConnected) {
    await deployNow(customer, true);
    return;
  }
  try {
    await redeployService(customer.railwayServiceId, customer.railwayEnvironmentId);
    await db.update(customers).set({ deployError: null, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await logEvent(customer.id, "deploy", "Railway дахин deploy эхэллээ");
  } catch (error) {
    throw new DeployError(msg(error));
  }
}
