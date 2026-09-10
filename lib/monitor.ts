// Хяналт — 5 мин тутам (Railway cron → POST /api/cron/check) эсвэл гараар.
// Харилцагч бүрд: /api/health, Railway deployment, backup, custom domain,
// авто sync. Төлөв ӨӨРЧЛӨГДӨХ үед л мэдэгдэл (down/recovered, deploy унасан,
// domain баталгаажсан); унасан хэвээр бол 6 цаг тутам сануулна.
import { eq, inArray } from "drizzle-orm";

import { config } from "./config";
import { attachBackupsAndDomain } from "./deploy";
import { logEvent } from "./customers";
import { db } from "./db";
import { ensureSchema } from "./db/ensure";
import { consoleState, customers, type Customer } from "./db/schema";
import { dispatchWorkflow, fetchHealth, getDefaultBranch, getLatestRelease, getPull, listOpenSyncPulls, listWorkflowRuns, mergePull } from "./github";
import { notify } from "./notify";
import { getBackupStatus, getCustomDomain, latestDeployment, railwayConfigured, setBackupSchedule, DEFAULT_BACKUP_KINDS, upsertVariables } from "./railway";

export interface MonitorSummary {
  at: string;
  checked: number;
  down: string[];
  recovered: string[];
  deployFailed: string[];
  domainVerified: string[];
  synced: string[];
  merged: string[];
  errors: string[];
  alertsSent: number;
}

const REALERT_MS = 6 * 60 * 60 * 1000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const norm = (v: string | null | undefined) => (v ?? "").replace(/^v/, "");

export async function runMonitor(): Promise<MonitorSummary> {
  await ensureSchema();
  const now = new Date();
  const summary: MonitorSummary = { at: now.toISOString(), checked: 0, down: [], recovered: [], deployFailed: [], domainVerified: [], synced: [], merged: [], errors: [], alertsSent: 0 };
  const rows = await db.select().from(customers).where(inArray(customers.status, ["active", "provisioning"]));
  const latest = await getLatestRelease().catch(() => null);
  const alerts: string[] = [];

  for (const c of rows) {
    summary.checked += 1;
    const patch: Partial<typeof customers.$inferInsert> = {};
    const label = `${c.displayName} (${c.slug})`;

    // 1. Health
    if (c.appUrl && c.status === "active") {
      const health = await fetchHealth(c.appUrl);
      const ok = !!health?.ok;
      patch.healthOk = ok;
      patch.healthCheckedAt = now;
      if (c.healthOk !== ok) {
        patch.healthChangedAt = now;
        if (!ok) {
          summary.down.push(c.slug);
          alerts.push(`🔴 ${label} — апп хүрэхгүй: ${health?.error ?? "unknown"}\n${c.appUrl}`);
          patch.alertedAt = now;
          await logEvent(c.id, "alert", `Апп хүрэхгүй: ${health?.error ?? "unknown"}`);
        } else if (c.healthOk === false) {
          summary.recovered.push(c.slug);
          alerts.push(`🟢 ${label} — апп сэргэлээ (v${health?.version ?? "?"})`);
          await logEvent(c.id, "alert", "Апп сэргэлээ");
        }
      } else if (!ok && c.alertedAt && now.getTime() - c.alertedAt.getTime() > REALERT_MS) {
        alerts.push(`🔴 ${label} — ${Math.round((now.getTime() - (c.healthChangedAt ?? now).getTime()) / 3600000)} цаг хүрэхгүй хэвээр\n${c.appUrl}`);
        patch.alertedAt = now;
      }
    }

    // 2. Railway deployment / backup / domain
    if (railwayConfigured() && c.railwayProjectId && c.railwayEnvironmentId) {
      if (c.railwayServiceId && c.railwayRepoConnected) {
        try {
          const dep = await latestDeployment(c.railwayProjectId, c.railwayEnvironmentId, c.railwayServiceId);
          const st = dep?.status ?? null;
          if (st && st !== c.lastDeployStatus) {
            patch.lastDeployStatus = st;
            if (st === "FAILED" || st === "CRASHED") {
              summary.deployFailed.push(c.slug);
              alerts.push(`⚠️ ${label} — Railway deployment ${st}`);
              await logEvent(c.id, "alert", `Railway deployment ${st}`);
            }
          }
        } catch (error) {
          summary.errors.push(`${c.slug} deployment: ${msg(error)}`);
        }
      }
      // Backup/domain дутуу бол нөхнө (хуучин харилцагч, унасан алхам)
      if (c.railwayPostgresServiceId && (!c.railwayVolumeInstanceId || (config.baseDomain && !c.customDomainId))) {
        try {
          Object.assign(patch, await attachBackupsAndDomain({ ...c, ...patch } as Customer));
        } catch (error) {
          summary.errors.push(`${c.slug} backup/domain: ${msg(error)}`);
        }
      }
      const vi = patch.railwayVolumeInstanceId ?? c.railwayVolumeInstanceId;
      if (vi) {
        try {
          const b = await getBackupStatus(vi);
          if (b.kinds.length === 0) {
            await setBackupSchedule(vi, DEFAULT_BACKUP_KINDS);
            patch.backupSchedule = DEFAULT_BACKUP_KINDS.join(",");
          } else patch.backupSchedule = b.kinds.join(",");
          patch.lastBackupAt = b.lastBackupAt ? new Date(b.lastBackupAt) : null;
        } catch (error) {
          summary.errors.push(`${c.slug} backup: ${msg(error)}`);
        }
      }
      const domainId = patch.customDomainId ?? c.customDomainId;
      if (domainId && !c.customDomainVerified) {
        try {
          const d = await getCustomDomain(domainId, c.railwayProjectId);
          if (d.verified) {
            patch.customDomainVerified = true;
            const url = `https://${d.domain}`;
            patch.appUrl = url;
            if (c.railwayServiceId) await upsertVariables(c.railwayProjectId, c.railwayEnvironmentId, c.railwayServiceId, { NEXT_PUBLIC_APP_URL: url }, false);
            summary.domainVerified.push(c.slug);
            alerts.push(`🌐 ${label} — domain баталгаажлаа: ${url}`);
            await logEvent(c.id, "deploy", `Custom domain баталгаажлаа: ${url} (NEXT_PUBLIC_APP_URL шинэчлэгдэж дахин deploy)`);
          }
        } catch (error) {
          summary.errors.push(`${c.slug} domain: ${msg(error)}`);
        }
      }
    }

    // 3. Авто sync: PR merge (шалгалт давсан) + хоцорсон бол sync эхлүүлэх
    if (c.autoSync && c.status === "active") {
      try {
        const pulls = await listOpenSyncPulls(c.githubRepo);
        let note: string | null = null;
        for (const p of pulls) {
          const full = await getPull(c.githubRepo, p.number);
          if (full.labels.includes("sync-conflict")) note = `PR #${p.number}: merge conflict — гараар шийднэ`;
          else if (full.labels.includes("sync-checks-failed")) note = `PR #${p.number}: шалгалт (tsc/lint/test) унасан — гараар шалгана`;
          else if (full.labels.includes("sync-checks-passed") && full.mergeable === true) {
            await mergePull(c.githubRepo, p.number, `${p.title} (auto-merge)`);
            summary.merged.push(`${c.slug}#${p.number}`);
            await logEvent(c.id, "sync", `Авто merge: ${p.title} → Railway deploy хийнэ`);
          } else if (full.mergeable === false) note = `PR #${p.number}: merge хийх боломжгүй (${full.mergeableState})`;
        }
        patch.syncNote = note;
        // Хоцорсон + нээлттэй PR алга + sync ажиллаж байгаа эсэх
        const health = c.appUrl ? await fetchHealth(c.appUrl) : null;
        const behind = !!latest && !!health?.version && norm(health.version) !== norm(latest.tagName);
        if (behind && pulls.length === 0) {
          const runs = await listWorkflowRuns(c.githubRepo, "upstream-sync.yml", 1).catch(() => []);
          const running = runs[0] && runs[0].status !== "completed";
          const recent = runs[0] && now.getTime() - new Date(runs[0].createdAt).getTime() < 30 * 60 * 1000;
          if (!running && !recent) {
            const branch = await getDefaultBranch(c.githubRepo);
            await dispatchWorkflow(c.githubRepo, "upstream-sync.yml", branch, { ref: latest!.tagName });
            summary.synced.push(c.slug);
            await logEvent(c.id, "sync", `Авто sync эхэллээ: ${latest!.tagName}`);
          }
        }
      } catch (error) {
        summary.errors.push(`${c.slug} sync: ${msg(error)}`);
      }
    }

    if (Object.keys(patch).length > 0)
      await db.update(customers).set({ ...patch, updatedAt: now }).where(eq(customers.id, c.id));
  }

  for (const text of alerts) if (await notify(text)) summary.alertsSent += 1;
  await db
    .insert(consoleState)
    .values({ key: "monitor.last", value: summary, updatedAt: now })
    .onConflictDoUpdate({ target: consoleState.key, set: { value: summary, updatedAt: now } });
  return summary;
}

export async function lastMonitorRun(): Promise<MonitorSummary | null> {
  await ensureSchema();
  const row = await db.query.consoleState.findFirst({ where: eq(consoleState.key, "monitor.last") });
  return (row?.value as MonitorSummary | undefined) ?? null;
}
