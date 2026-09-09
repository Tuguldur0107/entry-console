import { PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { checkOwnerAccess, coreWorkflowExists, getCoreActionsConfig, getLatestRelease, getTokenInfo } from "@/lib/github";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тохиргоо, шалгалт" };

type Check = { ok: boolean | null; title: string; detail: string; fix?: string };

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // DB
  try {
    await ensureSchema();
    await db.execute(sql`select 1`);
    checks.push({ ok: true, title: "Postgres холболт", detail: "DATABASE_URL зөв, customers/customer_events хүснэгт бэлэн" });
  } catch (e) {
    checks.push({ ok: false, title: "Postgres холболт", detail: e instanceof Error ? e.message : String(e), fix: "Railway → entry-console → Variables → DATABASE_URL = ${{Entry console DB.DATABASE_URL}}" });
  }

  // Token
  let login = "";
  try {
    const t = await getTokenInfo();
    login = t.login;
    const need = ["repo", "workflow", "admin:org"];
    const missing = t.tokenType === "classic" ? need.filter((s) => !t.scopes.includes(s)) : [];
    if (t.tokenType === "fine-grained")
      checks.push({ ok: null, title: "GitHub token", detail: `@${t.login} · fine-grained token — org болон Secrets-д хандах эрх ихэвчлэн дутдаг`, fix: "Tokens (classic): repo, workflow, admin:org scope-той token ашигла" });
    else if (missing.length > 0)
      checks.push({ ok: false, title: "GitHub token", detail: `@${t.login} · classic · scope дутуу: ${missing.join(", ")}` + (t.scopes.length ? ` (байгаа: ${t.scopes.join(", ")})` : " (scope огт сонгоогүй)"), fix: "GitHub → Settings → Developer settings → Tokens (classic) → token дээр дарж scope чагтлаад Update token" });
    else checks.push({ ok: true, title: "GitHub token", detail: `@${t.login} · classic · ${t.scopes.join(", ")}` });
  } catch (e) {
    checks.push({ ok: false, title: "GitHub token", detail: e instanceof Error ? e.message : String(e), fix: "Railway → entry-console → Variables → GITHUB_TOKEN" });
  }

  // Owner access
  const owner = await checkOwnerAccess();
  checks.push({ ok: owner.ok, title: `Repo эзэн: ${config.owner} (${config.ownerType})`, detail: owner.detail, fix: owner.ok ? undefined : "Token org-д admin эрхтэй байх ёстой (classic: admin:org) эсвэл GITHUB_OWNER/GITHUB_OWNER_TYPE-ийг шалга" });

  // Core repo
  try {
    const rel = await getLatestRelease();
    checks.push({ ok: !!rel, title: `Core repo: ${config.coreRepo}`, detail: rel ? `сүүлийн release ${rel.tagName}` : "release алга — git tag vX.Y.Z push хийнэ", fix: rel ? undefined : "git tag v1.0.0 && git push origin v1.0.0" });
  } catch (e) {
    checks.push({ ok: false, title: `Core repo: ${config.coreRepo}`, detail: e instanceof Error ? e.message : String(e) });
  }
  const wf = await coreWorkflowExists("provision-customer.yml");
  checks.push({ ok: wf, title: "provision-customer.yml workflow", detail: wf ? "core repo-д бий" : "олдсонгүй — core main-д merge хийгдсэн эсэхийг шалга" });

  const core = await getCoreActionsConfig();
  if (core.error) {
    checks.push({ ok: false, title: "Core Secrets / Variables", detail: core.error, fix: "Token-д repo scope хэрэгтэй (secrets унших)" });
  } else {
    const hasProv = core.secrets.includes("PROVISION_TOKEN");
    checks.push({ ok: hasProv, title: "Secret PROVISION_TOKEN (core)", detail: hasProv ? "тавигдсан" : "байхгүй — workflow repo үүсгэж чадахгүй", fix: hasProv ? undefined : "entry-accounting → Settings → Secrets and variables → Actions → New secret: PROVISION_TOKEN = GitHub token" });
    const hasRead = core.secrets.includes("UPSTREAM_READ_TOKEN");
    checks.push({ ok: hasRead ? true : null, title: "Secret UPSTREAM_READ_TOKEN (core)", detail: hasRead ? "тавигдсан" : "байхгүй — core public бол хэрэггүй; private болговол заавал" });
    const co = core.variables.CUSTOMER_OWNER;
    const ownerOk = (co ?? "").toLowerCase() === config.owner.toLowerCase() || (!co && config.ownerType === "user");
    checks.push({ ok: ownerOk, title: "Variable CUSTOMER_OWNER (core)", detail: co ? `= ${co}` : "тавиагүй → repo core repo-ийн эзэн дээр үүснэ", fix: ownerOk ? undefined : `entry-accounting → Settings → Secrets and variables → Actions → Variables → CUSTOMER_OWNER = ${config.owner}` });
  }
  void login;
  return checks;
}

export default async function SettingsPage() {
  await requireSession();
  const checks = await runChecks();
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
      <Section title="Орчны тохиргоо" sub="Railway → entry-console → Variables">
        <dl className="grid gap-2 text-sm sm:grid-cols-[200px_1fr]">
          {[["GITHUB_OWNER", config.owner], ["GITHUB_OWNER_TYPE", config.ownerType], ["CORE_REPO", config.coreRepo], ["Харилцагчийн repo topic", config.customerTopic], ["Repo нэрийн угтвар", config.repoPrefix]].map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-text-3">{k}</dt><dd className="mono">{v}</dd></div>
          ))}
        </dl>
      </Section>
      <Section title="Урсгал" sub="Юу хаана болдог вэ">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-2">
          <li>«Харилцагч нэмэх» → бүртгэл DB-д, core repo-ийн <span className="mono">provision-customer.yml</span> dispatch.</li>
          <li>Workflow: <span className="mono">{config.owner}/entry-&lt;код&gt;</span> repo, core түүх push, Actions permission, secret, урилга.</li>
          <li>Самбар repo-г олмогц харилцагч «Идэвхтэй» болно; Deploy хаяг өгвөл хувилбар хянагдана.</li>
          <li>Core-д шинэ release гарахад «Бүгдийг vX.Y.Z болгох» → харилцагч бүрд upstream-sync PR.</li>
        </ol>
      </Section>
    </div>
  );
}
