import Link from "next/link";
import { notFound } from "next/navigation";

import { ApproveForm, AutoSyncToggle, UpstreamAccessPanel, BackupPanel, CopyButton, CustomerEditForm, DeleteRequestButton, DeployPanel, DestroyForm, DomainForm, InviteForm, NoteForm, RejectForm, StatusActions, SyncButton } from "@/components/forms";
import { Icons } from "@/components/icons";
import { EVENT_LABELS, HealthBadge, PLAN_LABELS, RunBadge, SOURCE_LABELS, Section, StatusBadge, fmtAgo, fmtDate, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getCustomerBySlug, loadCustomerDetail } from "@/lib/customers";
import { db } from "@/lib/db";
import { customerEvents, isRequestStatus } from "@/lib/db/schema";
import { getLatestRelease } from "@/lib/github";
import { desc, eq } from "drizzle-orm";
import { deployBlocker } from "@/lib/deploy";
import { railwayConfigured, railwayProjectUrl } from "@/lib/railway";
import { config } from "@/lib/config";
import { teardownPlan } from "@/lib/teardown";
import { upstreamAccessState } from "@/lib/upstream-access";
import type { Customer } from "@/lib/db/schema";

export const dynamic = "force-dynamic";


export default async function CustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;
  const row = await getCustomerBySlug(slug);
  if (!row) notFound();
  if (isRequestStatus(row.status)) return <RequestPage c={row} />;
  const { latest, customer } = await loadCustomerDetail(row);
  const c = customer.customer;
  const repo = customer.repo;
  const repoUrl = repo?.htmlUrl ?? `https://github.com/${c.githubRepo}`;
  const deployed = !!c.railwayServiceId;
  const plan = await teardownPlan(c, !!repo);
  const destroyItems = [
    ...(plan.railwayApp ? [`Railway service «entry-${c.slug}» (апп, domain, хувьсагчид)`] : []),
    ...(plan.railwayDb ? [`Railway service «entry-${c.slug}-db» — Postgres, volume-ийн БҮХ өгөгдөл`] : []),
    ...(plan.githubRepo ? [`GitHub repo ${c.githubRepo} (код, түүх, collaborator)`] : []),
    "Console-ийн бүртгэл, түүх, тэмдэглэл",
  ];
  const railwayUrl = c.railwayProjectId ? railwayProjectUrl(c.railwayProjectId, c.railwayServiceId ?? undefined) : null;
  const access = repo ? await upstreamAccessState(c).catch(() => null) : null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1 text-xs text-text-3 hover:text-text-1"><Icons.arrowLeft className="h-3.5 w-3.5" /> Харилцагчид</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{c.displayName}</h1>
            <StatusBadge status={c.status} />
            <span className="badge badge-muted badge-plain">{PLAN_LABELS[c.plan]}</span>
            <HealthBadge health={customer.health} behind={customer.behind} latest={latest?.tagName ?? null} />
          </div>
          <div className="flex flex-wrap gap-2">
            {c.appUrl && <a href={c.appUrl} target="_blank" rel="noreferrer" className="btn btn-sm"><Icons.external className="h-4 w-4" /> Апп нээх</a>}
            <a href={repoUrl} target="_blank" rel="noreferrer" className="btn btn-sm"><Icons.github className="h-4 w-4" /> Repo</a>
          </div>
        </div>
        <p className="mt-1 text-sm text-text-3">
          <span className="mono">{c.githubRepo}</span> · бүртгэсэн {fmtDate(c.createdAt, false)}
          {c.seededRef && <> · seed <span className="mono">{c.seededRef}</span></>}
          {customer.health?.sha && <> · deploy <span className="mono">{customer.health.sha.slice(0, 7)}</span></>}
        </p>
      </div>

      {!repo && c.status === "provisioning" && (
        <div className="notice notice-warning">
          <strong>Repo үүсгэж байна.</strong>{" "}
          {customer.provisionRun ? (
            <>Core дээр workflow <a href={customer.provisionRun.htmlUrl} target="_blank" rel="noreferrer" className="underline">{customer.provisionRun.status}{customer.provisionRun.conclusion ? ` · ${customer.provisionRun.conclusion}` : ""}</a>. Дууссаны дараа хуудсыг сэргээхэд «Идэвхтэй» болно.</>
          ) : (
            <>Workflow run олдсонгүй — <Link href="/settings" className="underline">Тохиргоо, шалгалт</Link> хуудсаар PROVISION_TOKEN, CUSTOMER_OWNER-ыг шалга.</>
          )}
        </div>
      )}
      {repo && !repo.pushedAt && (
        <div className="notice notice-danger">
          <strong>Repo үүссэн ч хоосон.</strong> Core түүх push хийгдээгүй — core repo-ийн Actions → «Provision customer» → Run workflow (slug: <span className="mono">{c.slug}</span>) дахин ажиллуулна; repo-г устгах шаардлагагүй.
        </div>
      )}
      {!repo && c.status !== "provisioning" && (
        <div className="notice notice-danger">GitHub дээр <span className="mono">{c.githubRepo}</span> олдсонгүй (устгагдсан эсвэл token хандахгүй).</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Бүртгэл, гэрээ, төлбөр" sub="Энд хадгалагдана; repo-д нөлөөлөхгүй (Deploy хаягаас бусад)">
            <CustomerEditForm customer={c} />
          </Section>

          <Section
            title="Хостинг (Railway)"
            sub={deployed && c.railwayRepoConnected ? "App + Postgres service Railway дээр · commit push хийгдэх бүрд автоматаар deploy хийгдэнэ" : deployed ? "Service, Postgres, domain бэлэн — GitHub repo холбогдсоны дараа build эхэлнэ" : railwayConfigured() ? "Нэг товчоор app + Postgres service үүсч, хаяг бүртгэгдэнэ" : "Railway тохируулаагүй — Тохиргоо хуудсыг үзнэ үү"}
            right={railwayUrl ? <a href={railwayUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost"><Icons.external className="h-4 w-4" /> Railway</a> : undefined}
          >
            {deployed && (
              <dl className="mb-3 space-y-2 text-sm">
                <Row k="Repo холболт" v={c.railwayRepoConnected ? <span className="badge badge-success">холбогдсон</span> : <span className="badge badge-warning">холбогдоогүй</span>} />
                <Row k="Сүүлийн deployment" v={<DeployStatus status={customer.railway?.status ?? null} at={customer.railway?.createdAt ?? null} />} />
                <Row k="Хаяг" v={c.appUrl ? <a href={c.appUrl} target="_blank" rel="noreferrer" className="hover:underline">{c.appUrl.replace(/^https?:\/\//, "")}</a> : "—"} />
                <Row k="Service" v={<span className="mono">entry-{c.slug} · entry-{c.slug}-db</span>} />
              </dl>
            )}
            <DeployPanel slug={slug} deployed={deployed} connected={c.railwayRepoConnected} autoDeploy={c.autoDeploy} blocker={deployed && c.railwayRepoConnected ? null : deployBlocker(c, !!repo?.pushedAt)} deployError={c.deployError} />
            {deployed && (
              <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-text-3">Нөөцлөлт (Railway volume backup)</div>
                  <dl className="mb-2 space-y-1 text-sm">
                    <Row k="Хуваарь" v={c.backupSchedule ? <span className="badge badge-success">{c.backupSchedule.split(",").map((k) => ({ DAILY: "өдөр бүр", WEEKLY: "7 хоног бүр", MONTHLY: "сар бүр" })[k] ?? k).join(" + ")}</span> : <span className="badge badge-warning">тохируулаагүй</span>} />
                    <Row k="Сүүлийн backup" v={c.lastBackupAt ? <span title={fmtDate(c.lastBackupAt)}>{fmtAgo(c.lastBackupAt)}</span> : "—"} />
                  </dl>
                  <BackupPanel slug={slug} hasVolume={!!c.railwayVolumeInstanceId} hasDomainSlot={!!config.baseDomain && !c.customDomainId} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-text-3">Custom domain</div>
                  {c.customDomain ? (
                    <dl className="mb-2 space-y-1 text-sm">
                      <Row k="Domain" v={<span className="mono">{c.customDomain}</span>} />
                      <Row k="Төлөв" v={c.customDomainVerified ? <span className="badge badge-success">баталгаажсан · SSL</span> : <span className="badge badge-warning">DNS хүлээж байна</span>} />
                      {!c.customDomainVerified && c.dnsTarget && (
                        <div className="rounded-md bg-surface-2 p-2 text-xs">
                          DNS-д нэмнэ: <span className="mono">CNAME {c.customDomain} → {c.dnsTarget}</span>
                          <CopyButton text={c.dnsTarget} label="Хуулах" />
                          <div className="mt-1 text-text-3">Тархахад 5–30 мин; хяналт автоматаар баталгаажуулж хаягийг солино.</div>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="mb-2 text-sm text-text-3">{config.baseDomain ? `${c.slug}.${config.baseDomain} автоматаар үүснэ (дээрх «Domain үүсгэх»)` : "Тохиргоонд CUSTOMER_BASE_DOMAIN өгвөл автоматаар; эсвэл гараар:"}</p>
                  )}
                  <DomainForm slug={slug} current={c.customDomain} />
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs font-medium text-text-3">Хяналт</div>
                  <p className="text-sm">
                    {c.healthOk === null ? <span className="text-text-3">хараахан шалгаагүй — Тохиргоо → Хяналт</span> : c.healthOk ? <span className="badge badge-success">ажиллаж байна</span> : <span className="badge badge-danger">хүрэхгүй</span>}
                    {c.healthCheckedAt && <span className="ml-2 text-xs text-text-3">шалгасан {fmtAgo(c.healthCheckedAt)}{c.healthChangedAt ? ` · энэ төлөвт орсон ${fmtAgo(c.healthChangedAt)}` : ""}</span>}
                  </p>
                </div>
              </div>
            )}
          </Section>

          <Section title="Core шинэчлэлт" sub={`Харилцагчийн repo дээр upstream-sync.yml ажиллаж PR нээнэ · core ${latest?.tagName ?? "—"}`}>
            <SyncButton slug={slug} defaultRef={latest?.tagName ?? null} />
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2 text-xs font-medium text-text-3">Шинэчлэлт авах эрх (захиалгын гарц)</div>
              {access ? (
                <UpstreamAccessPanel slug={slug} granted={access.granted} keyOnCore={access.keyOnCore} secretOnRepo={access.secretOnRepo} pushKeyReady={access.pushKeyReady} />
              ) : (
                <p className="text-sm text-text-3">Repo бэлэн болсны дараа харагдана.</p>
              )}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <AutoSyncToggle slug={slug} on={c.autoSync} />
              {c.syncNote && <p className="notice notice-warning mt-2">{c.syncNote}</p>}
            </div>
            {customer.openPulls.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-text-3">Нээлттэй PR</div>
                <ul className="space-y-1 text-sm">
                  {customer.openPulls.map((p) => <li key={p.number}><a href={p.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">#{p.number} {p.title}</a></li>)}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-text-3">Сүүлийн sync ажиллагаа</div>
              {customer.syncRuns.length === 0 ? <p className="text-sm text-text-3">—</p> : (
                <ul className="space-y-1.5 text-sm">
                  {customer.syncRuns.map((run) => <li key={run.id} className="flex items-center gap-2"><RunBadge run={run} /><span className="text-text-3">{fmtDate(run.createdAt)}</span></li>)}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Түүх" sub="Бүх үйлдэл, тэмдэглэл">
            <NoteForm slug={slug} />
            <ul className="mt-3 divide-y divide-border text-sm">
              {customer.events.map((e) => (
                <li key={e.id} className="flex gap-3 py-2.5">
                  <span className="w-16 shrink-0 text-xs text-text-3" title={fmtDate(e.createdAt)}>{fmtAgo(e.createdAt)}</span>
                  <span className="badge badge-muted badge-plain shrink-0">{EVENT_LABELS[e.type] ?? e.type}</span>
                  <span className="text-text-2">{e.message}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Хураангуй">
            <dl className="space-y-2 text-sm">
              <Row k="Сарын төлбөр" v={Number(c.monthlyFee) > 0 ? `${fmtMnt(c.monthlyFee)}` : "—"} />
              <Row k="Төлбөр эхлэх" v={c.billingStartsAt ?? "—"} />
              <Row k="ТТД" v={c.registerNo ?? "—"} />
              <Row k="Холбоо барих" v={[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join(" · ") || "—"} />
              <Row k="Deploy" v={c.appUrl ? <a href={c.appUrl} target="_blank" rel="noreferrer" className="hover:underline">{c.appUrl.replace(/^https?:\/\//, "")}</a> : "—"} />
            </dl>
          </Section>

          <Section title="GitHub хандах эрх" sub="Харилцагчийн IT-д Write хангалттай">
            <ul className="mb-3 space-y-1.5 text-sm">
              {customer.collaborators.length === 0 && <li className="text-text-3">{repo ? "Collaborator алга" : "—"}</li>}
              {customer.collaborators.map((col) => (
                <li key={col.login} className="flex flex-wrap items-center gap-2">
                  <a href={col.htmlUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">{col.login}</a>
                  <span className="badge badge-muted badge-plain">{col.permission}</span>
                  {col.pending && <span className="badge badge-warning">хүлээгдэж байна</span>}
                </li>
              ))}
            </ul>
            {repo && <InviteForm slug={slug} />}
          </Section>

          <Section title="Харилцагчид өгөх мэдээлэл" sub="Хуулж илгээнэ">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="mono truncate">{repoUrl}</span><CopyButton text={repoUrl} /></div>
              {c.appUrl && <div className="flex items-center justify-between gap-2"><span className="mono truncate">{c.appUrl}</span><CopyButton text={c.appUrl} /></div>}
              {c.contactEmail && c.appUrl && (
                <a className="btn btn-sm" href={`mailto:${c.contactEmail}?subject=${encodeURIComponent(`Entry Accounting — ${c.displayName} системийн хаяг`)}&body=${encodeURIComponent(`Сайн байна уу, ${c.contactName ?? ""}.\n\n${c.displayName}-ийн Entry Accounting систем бэлэн боллоо:\n${c.appUrl}\n\nДээрх хаягаар орж «Бүртгүүлэх» дарж анхны админ хэрэглэгчээ үүсгэнэ үү.\n`)}`}>
                  Хаягийг имэйлээр илгээх
                </a>
              )}
              <div className="flex items-center justify-between gap-2"><span className="mono truncate">{c.appUrl ?? "https://<app>"}/api/mcp</span><CopyButton text={`${c.appUrl ?? "https://<app>"}/api/mcp`} label="MCP URL" /></div>
            </div>
          </Section>

          <Section title="Төлөв">
            <StatusActions slug={slug} status={c.status} />
          </Section>

          <Section title="Аюултай бүс" sub="Гэрээ дууссан, эсвэл туршилтын харилцагчийг цэвэрлэх">
            <DestroyForm slug={slug} items={destroyItems} warnings={plan.warnings} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Хүсэлт (pending/rejected) — repo, Railway хараахан байхгүй тул тусдаа, энгийн хуудас. */
async function RequestPage({ c }: { c: Customer }) {
  const [latest, events] = await Promise.all([
    getLatestRelease().catch(() => null),
    db.select().from(customerEvents).where(eq(customerEvents.customerId, c.id)).orderBy(desc(customerEvents.createdAt)).limit(20),
  ]);
  const mail = c.contactEmail ? `mailto:${c.contactEmail}?subject=${encodeURIComponent(`Entry Accounting — ${c.displayName}`)}` : null;
  return (
    <div className="space-y-5">
      <div>
        <Link href="/customers?status=pending" className="inline-flex items-center gap-1 text-xs text-text-3 hover:text-text-1"><Icons.arrowLeft className="h-3.5 w-3.5" /> Хүсэлтүүд</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{c.displayName}</h1>
          <StatusBadge status={c.status} />
          <span className="badge badge-muted badge-plain">{SOURCE_LABELS[c.source] ?? c.source}</span>
        </div>
        <p className="mt-1 text-sm text-text-3">Хүсэлт ирсэн {fmtDate(c.createdAt)} ({fmtAgo(c.createdAt)}){c.decidedAt && <> · шийдвэр {fmtDate(c.decidedAt)}</>}</p>
      </div>

      {c.status === "rejected" && (
        <div className="notice notice-warning"><strong>Татгалзсан.</strong> {c.decisionNote ?? "Шалтгаан бичээгүй."} Доорх маягтаар дахин батлах боломжтой.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title={c.status === "pending" ? "Батлах" : "Дахин батлах"} sub="Батлахад core repo дээр provision workflow → GitHub repo → (автомат бол) Railway app + Postgres. Хүсэлт гаргагчид та өөрөө хаягийг нь илгээнэ.">
            <ApproveForm customer={c} latestTag={latest?.tagName ?? null} owner={config.owner} railwayOn={railwayConfigured()} />
          </Section>
          <Section title="Түүх">
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 py-2.5">
                  <span className="w-16 shrink-0 text-xs text-text-3" title={fmtDate(e.createdAt)}>{fmtAgo(e.createdAt)}</span>
                  <span className="badge badge-muted badge-plain shrink-0">{EVENT_LABELS[e.type] ?? e.type}</span>
                  <span className="text-text-2">{e.message}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Хүсэлтийн мэдээлэл">
            <dl className="space-y-2 text-sm">
              <Row k="Хүссэн код" v={<span className="mono">entry-{c.slug}</span>} />
              <Row k="ТТД" v={c.registerNo ?? "—"} />
              <Row k="Холбоо барих" v={c.contactName ?? "—"} />
              <Row k="Утас" v={c.contactPhone ?? "—"} />
              <Row k="Имэйл" v={mail ? <a href={mail} className="hover:underline">{c.contactEmail}</a> : "—"} />
            </dl>
            {c.requestNote && <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm text-text-2">«{c.requestNote}»</p>}
          </Section>
          {c.status === "pending" && (
            <Section title="Татгалзах" sub="Бүртгэл лавлагаанд үлдэнэ">
              <RejectForm slug={c.slug} />
            </Section>
          )}
          <Section title="Аюултай бүс" sub="Repo, Railway байхгүй — зөвхөн энэ бүртгэл устна">
            <DeleteRequestButton slug={c.slug} />
          </Section>
        </div>
      </div>
    </div>
  );
}

const DEPLOY_TONE: Record<string, string> = {
  SUCCESS: "badge-success", BUILDING: "badge-warning", DEPLOYING: "badge-warning", INITIALIZING: "badge-warning", QUEUED: "badge-warning", WAITING: "badge-warning",
  FAILED: "badge-danger", CRASHED: "badge-danger", REMOVED: "badge-muted", SLEEPING: "badge-muted", SKIPPED: "badge-muted",
};
const DEPLOY_LABEL: Record<string, string> = {
  SUCCESS: "Амжилттай", BUILDING: "Build хийж байна", DEPLOYING: "Deploy хийж байна", INITIALIZING: "Эхэлж байна", QUEUED: "Дараалалд", WAITING: "Хүлээж байна",
  FAILED: "Амжилтгүй", CRASHED: "Унасан", REMOVED: "Устгагдсан", SLEEPING: "Унтаа", SKIPPED: "Алгассан",
};

function DeployStatus({ status, at }: { status: string | null; at: string | null }) {
  if (!status) return <span className="text-text-3">мэдээлэл алга</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`badge ${DEPLOY_TONE[status] ?? "badge-muted"}`}>{DEPLOY_LABEL[status] ?? status}</span>
      {at && <span className="text-xs text-text-3">{fmtAgo(at)}</span>}
    </span>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-3">{k}</dt>
      <dd className="text-right text-text-1">{v}</dd>
    </div>
  );
}
