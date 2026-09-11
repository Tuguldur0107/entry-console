import { sql } from "drizzle-orm";

import { PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { checkOwnerAccess, coreWorkflowExists, getCoreActionsConfig, getLatestRelease, getTokenInfo } from "@/lib/github";
import { findServiceByName, MONITOR_SERVICE_NAME, railwayCheck, railwayMode } from "@/lib/railway";
import { lastMonitorRun } from "@/lib/monitor";
import { alertChannels } from "@/lib/notify";
import { MonitorButtons } from "@/components/forms";
import { fmtAgo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тохиргоо, шалгалт" };

type Check = { ok: boolean | null; title: string; detail: string; fix?: string };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function dbCheck(): Promise<Check> {
  try {
    await ensureSchema();
    await db.execute(sql`select 1`);
    return { ok: true, title: "Postgres холболт", detail: "DATABASE_URL зөв, customers/customer_events хүснэгт бэлэн" };
  } catch (e) {
    return { ok: false, title: "Postgres холболт", detail: msg(e), fix: "Railway → entry-console → Variables → DATABASE_URL = ${{Entry console DB.DATABASE_URL}}" };
  }
}

async function runChecks(): Promise<Check[]> {
  const need = config.ownerType === "org" ? ["repo", "workflow", "admin:org"] : ["repo", "workflow"];
  const fixToken = "GitHub → Settings → Developer settings → Tokens (classic) → token дээр дарж scope чагтлаад Update token";

  const [dbResult, railwayResult, tokenResult, releaseResult, workflowResult, coreConfig] = await Promise.all([
    dbCheck(),
    railwayCheck().then((r) => ({ r, error: null as string | null })).catch((e) => ({ r: null, error: msg(e) })),
    getTokenInfo().then((t) => ({ t, error: null as string | null })).catch((e) => ({ t: null, error: msg(e) })),
    getLatestRelease().then((rel) => ({ rel, error: null as string | null })).catch((e) => ({ rel: null, error: msg(e) })),
    coreWorkflowExists("provision-customer.yml").then((exists) => ({ exists, error: null as string | null })).catch((e) => ({ exists: false, error: msg(e) })),
    getCoreActionsConfig(),
  ]);

  const checks: Check[] = [dbResult];

  // Token
  const t = tokenResult.t;
  if (!t) {
    checks.push({ ok: false, title: "GitHub token", detail: tokenResult.error ?? "token хүчингүй", fix: "Railway → entry-console → Variables → GITHUB_TOKEN" });
  } else if (t.tokenType === "fine-grained") {
    checks.push({ ok: null, title: "GitHub token", detail: `@${t.login} · fine-grained — org болон Secrets-д хандах эрх ихэвчлэн дутдаг`, fix: `Tokens (classic): ${need.join(", ")} scope-той token ашигла` });
  } else {
    // classic (ghp_) болон бусад (gho_/ghs_/40-hex) — x-oauth-scopes header-ээр шүүнэ
    const missing = need.filter((s) => !t.scopes.includes(s));
    if (t.tokenType === "unknown" && t.scopes.length === 0)
      checks.push({ ok: null, title: "GitHub token", detail: `@${t.login} · төрөл тодорхойгүй, scope мэдээлэл алга`, fix: fixToken });
    else if (missing.length > 0)
      checks.push({ ok: false, title: "GitHub token", detail: `@${t.login} · scope дутуу: ${missing.join(", ")}` + (t.scopes.length ? ` (байгаа: ${t.scopes.join(", ")})` : " (scope огт сонгоогүй)"), fix: fixToken });
    else checks.push({ ok: true, title: "GitHub token", detail: `@${t.login} · ${t.scopes.join(", ")}` });
    checks.push(
        t.scopes.includes("delete_repo")
          ? { ok: true, title: "Харилцагч устгах (delete_repo scope)", detail: "repo устгах эрхтэй" }
          : { ok: null, title: "Харилцагч устгах (delete_repo scope)", detail: "token-д delete_repo алга — «Бүрэн устгах» үед GitHub repo устахгүй (Railway хэсэг устна)", fix: "Tokens (classic) → token → delete_repo чагтлаад Update token" }
      );
  }

  // Owner
  if (t) {
    const owner = await checkOwnerAccess(t.login);
    checks.push({ ok: owner.ok, title: `Repo эзэн: ${config.owner} (${config.ownerType})`, detail: owner.detail, fix: owner.ok ? undefined : config.ownerType === "org" ? "Token org-д admin эрхтэй байх ёстой (classic: admin:org)" : "GITHUB_OWNER-ийг token-ийн эзэнтэй тааруул эсвэл GITHUB_OWNER_TYPE=org болго" });
  }

  // Core
  checks.push(releaseResult.error
    ? { ok: false, title: `Core repo: ${config.coreRepo}`, detail: releaseResult.error }
    : { ok: !!releaseResult.rel, title: `Core repo: ${config.coreRepo}`, detail: releaseResult.rel ? `сүүлийн release ${releaseResult.rel.tagName}` : "release алга", fix: releaseResult.rel ? undefined : "git tag v1.0.0 && git push origin v1.0.0" });
  checks.push(workflowResult.error
    ? { ok: false, title: "provision-customer.yml workflow", detail: workflowResult.error, fix: "Token core repo-д хандах эрхтэй эсэхийг шалга" }
    : { ok: workflowResult.exists, title: "provision-customer.yml workflow", detail: workflowResult.exists ? "core repo-д бий" : "олдсонгүй — core main-д merge хийгдсэн эсэхийг шалга" });

  if (coreConfig.error) {
    checks.push({ ok: false, title: "Core Secrets / Variables", detail: coreConfig.error, fix: "Token-д repo scope хэрэгтэй (secrets унших)" });
  } else {
    const hasProv = coreConfig.secrets.includes("PROVISION_TOKEN");
    checks.push({ ok: hasProv, title: "Secret PROVISION_TOKEN (core)", detail: hasProv ? "тавигдсан" : "байхгүй — workflow repo үүсгэж чадахгүй", fix: hasProv ? undefined : "entry-accounting → Settings → Secrets and variables → Actions → New secret: PROVISION_TOKEN = GitHub token" });
    const hasRead = coreConfig.secrets.includes("UPSTREAM_READ_TOKEN");
    checks.push({ ok: hasRead ? true : null, title: "Secret UPSTREAM_READ_TOKEN (core)", detail: hasRead ? "тавигдсан" : "байхгүй — core public бол хэрэггүй; private болговол заавал" });
    // Workflow-ийн default = core repo-ийн эзэн (github.repository_owner)
    const effectiveOwner = coreConfig.variables.CUSTOMER_OWNER || config.coreRepo.split("/")[0];
    const ownerOk = effectiveOwner.toLowerCase() === config.owner.toLowerCase();
    checks.push({ ok: ownerOk, title: "Variable CUSTOMER_OWNER (core)", detail: coreConfig.variables.CUSTOMER_OWNER ? `= ${coreConfig.variables.CUSTOMER_OWNER}` : `тавиагүй → workflow ${effectiveOwner} дээр repo үүсгэнэ`, fix: ownerOk ? undefined : `entry-accounting → Settings → Secrets and variables → Actions → Variables → CUSTOMER_OWNER = ${config.owner}` });
  }

  // Railway (сонголтоор — тохируулаагүй бол deploy гараар)
  const fixRailway = "Railway → Account settings → Tokens → account token үүсгээд entry-console Variables: RAILWAY_TOKEN + RAILWAY_PROJECT_ID (харилцагчид энэ project дотор service болно)";
  const ghAppNote = `Railway-ийн GitHub app ${config.owner} org-д суусан байх ёстой: github.com/apps/railway-app/installations/new`;
  if (railwayResult.error)
    checks.push({ ok: false, title: "Railway (автомат deploy)", detail: railwayResult.error, fix: fixRailway });
  else if (!railwayResult.r || railwayResult.r.mode === "off")
    checks.push({ ok: null, title: "Railway (автомат deploy)", detail: "тохируулаагүй — харилцагчийн deploy-г гараар хийнэ", fix: fixRailway });
  else if (!railwayResult.r.canConnectRepo)
    checks.push({ ok: null, title: "Railway (project token)", detail: `${railwayResult.r.detail} · project token GitHub repo ХОЛБОЖ ЧАДАХГҮЙ — service, DB, domain үүсээд repo-г гараар холбох хэрэгтэй`, fix: `${fixRailway} · ${ghAppNote}` });
  else
    checks.push({ ok: true, title: "Railway (account token)", detail: `${railwayResult.r.detail} · ${ghAppNote}` });
  return checks;
}

export default async function SettingsPage() {
  await requireSession();
  const [checks, last, cron] = await Promise.all([
    runChecks(),
    lastMonitorRun().catch(() => null),
    config.self.projectId && config.self.environmentId && railwayMode() !== "off"
      ? findServiceByName(config.self.projectId, config.self.environmentId, MONITOR_SERVICE_NAME).catch(() => null)
      : Promise.resolve(null),
  ]);
  const channels = alertChannels();
  const bad = checks.filter((c) => c.ok === false).length;
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Тохиргоо, шалгалт" sub={bad === 0 ? "Бүх шалгалт ногоон — харилцагч нэмэхэд бэлэн" : `${bad} асуудал засах шаардлагатай`} />
      <Section title="Системийн шалгалт" sub="Хуудас нээх бүрд шинээр шалгана">
        <div>
          {checks.map((c, i) => (
            <div key={i} className="check-row">
              <span className={`check-dot ${c.ok === true ? "check-ok" : c.ok === false ? "check-fail" : "check-warn"}`}>{c.ok === true ? "✓" : c.ok === false ? "✕" : "!"}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.title}</div>
                <div className="text-sm text-text-2">{c.detail}</div>
                {c.fix && c.ok !== true && <div className="mono mt-1 rounded bg-surface-2 px-2 py-1 text-text-2">{c.fix}</div>}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Хяналт, мэдэгдэл" sub="Railway cron service 5 мин тутам /api/cron/check дуудна: health, deployment, backup, domain, авто sync">
        <div className="mb-3 space-y-1 text-sm">
          <div className="flex gap-2"><span className={`check-dot ${cron ? "check-ok" : "check-warn"}`}>{cron ? "✓" : "!"}</span><span>Cron service <span className="mono">{MONITOR_SERVICE_NAME}</span>: {cron ? "ажиллаж байна" : "үүсгээгүй — доорх товчоор нэг удаа"}</span></div>
          <div className="flex gap-2"><span className={`check-dot ${process.env.CONSOLE_API_KEY ? "check-ok" : "check-warn"}`}>{process.env.CONSOLE_API_KEY ? "✓" : "!"}</span><span>CONSOLE_API_KEY: {process.env.CONSOLE_API_KEY ? "тавигдсан (cron + REST нэвтрэлт)" : "алга — идэвхжүүлэхэд автоматаар үүснэ"}</span></div>
          <div className="flex gap-2"><span className={`check-dot ${channels.length ? "check-ok" : "check-warn"}`}>{channels.length ? "✓" : "!"}</span><span>Мэдэгдлийн суваг: {channels.length ? channels.join(", ") : "алга — TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID эсвэл ALERT_WEBHOOK_URL (Slack/Discord) тавина"}</span></div>
          <div className="flex gap-2"><span className={`check-dot ${last ? "check-ok" : "check-warn"}`}>{last ? "✓" : "!"}</span><span>Сүүлийн шалгалт: {last ? `${fmtAgo(last.at)} · ${last.checked} харилцагч · унасан ${last.down.length} · merge ${last.merged.length} · sync ${last.synced.length}${last.errors.length ? ` · алдаа ${last.errors.length}` : ""}` : "хараахан ажиллаагүй"}</span></div>
          {last && last.errors.length > 0 && <ul className="mono ml-7 list-disc pl-4 text-xs text-text-2">{last.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
        <MonitorButtons hasCron={!!cron} hasKey={!!process.env.CONSOLE_API_KEY} />
      </Section>
      <Section title="Орчны тохиргоо" sub="Railway → entry-console → Variables">
        <dl className="grid gap-2 text-sm sm:grid-cols-[200px_1fr]">
          {[["GITHUB_OWNER", config.owner], ["GITHUB_OWNER_TYPE", config.ownerType], ["CORE_REPO", config.coreRepo], ["Харилцагчийн repo topic", config.customerTopic], ["Repo нэрийн угтвар", config.repoPrefix], ["Railway горим", railwayMode()], ["RAILWAY_PROJECT_ID", process.env.RAILWAY_PROJECT_ID ?? "—"], ["CUSTOMER_BASE_DOMAIN", config.baseDomain ?? "— (харилцагч бүрд <код>.<domain> автоматаар)"], ["Мэдэгдэл", channels.join(", ") || "—"]].map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-text-3">{k}</dt><dd className="mono">{v}</dd></div>
          ))}
        </dl>
      </Section>
      <Section title="Урсгал" sub="Юу хаана болдог вэ">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-2">
          <li>Хоёр зам: (а) нээлттэй <span className="mono">{config.self.publicUrl ?? ""}/signup</span> (эсвэл <span className="mono">POST /api/signup</span>) → «Хүсэлт» төлөвтэй бүртгэл, Telegram мэдэгдэл → самбараас «Батлах»; (б) «Харилцагч нэмэх» маягт. Хоёулаа → core repo-ийн <span className="mono">provision-customer.yml</span> dispatch.</li>
          <li>Workflow: <span className="mono">{config.owner}/entry-&lt;код&gt;</span> repo, core түүх push, Actions permission, secret, урилга.</li>
          <li>Самбар repo-г олмогц харилцагч «Идэвхтэй» болно; автомат deploy сонгосон бол Railway дээр <span className="mono">entry-&lt;код&gt;</span> + <span className="mono">entry-&lt;код&gt;-db</span> service үүсч хаяг бүртгэгдэнэ.</li>
          <li>Харилцагчийн repo-д commit орох бүрд Railway автоматаар дахин build хийнэ; console-оос «Дахин deploy» ч болно.</li>
          <li>Core-д шинэ release гарахад «Бүгдийг vX.Y.Z болгох» → хоцорсон харилцагч бүрд upstream-sync PR.</li>
        </ol>
      </Section>
    </div>
  );
}
