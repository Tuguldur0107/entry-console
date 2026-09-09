import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerEditForm, InviteForm, NoteForm, PLAN_LABELS, STATUS_LABELS, SyncButton } from "@/components/forms";
import { HealthBadge, RunBadge, fmtDate } from "@/components/status";
import { requireSession } from "@/lib/auth";
import { getCustomerBySlug, loadCustomerDetail } from "@/lib/customers";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  provisioned: "Үүсгэлт",
  activated: "Идэвхжсэн",
  sync: "Sync",
  invite: "Урилга",
  status: "Төлөв",
  note: "Тэмдэглэл",
  billing: "Төлбөр",
};

export default async function CustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;
  const row = await getCustomerBySlug(slug);
  if (!row) notFound();
  const { latest, customer } = await loadCustomerDetail(row);
  const c = customer.customer;
  const repo = customer.repo;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-text-3 hover:underline">← Самбар</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{c.displayName}</h1>
          <span className={`badge ${c.status === "active" ? "badge-success" : c.status === "provisioning" ? "badge-warning" : "badge-muted"}`}>
            {STATUS_LABELS[c.status]}
          </span>
          <span className="badge badge-muted">{PLAN_LABELS[c.plan]}</span>
          <HealthBadge health={customer.health} behind={customer.behind} latest={latest?.tagName ?? null} />
        </div>
        <p className="text-sm text-text-3">
          {repo ? (
            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">{repo.fullName}</a>
          ) : (
            c.githubRepo
          )}
          {" · "}бүртгэсэн {fmtDate(c.createdAt.toISOString())}
          {c.seededRef && ` · seed ${c.seededRef}`}
          {customer.health?.sha && ` · deploy ${customer.health.sha.slice(0, 7)}`}
        </p>
      </div>

      {!repo && (
        <div className="card border-warning bg-warning-bg p-4 text-sm">
          <strong>Repo хараахан үүсээгүй.</strong> Core repo дээр provision ажиллаж байна —{" "}
          {customer.provisionRun ? (
            <a href={customer.provisionRun.htmlUrl} target="_blank" rel="noreferrer" className="underline">
              run харах ({customer.provisionRun.status}
              {customer.provisionRun.conclusion ? ` · ${customer.provisionRun.conclusion}` : ""})
            </a>
          ) : (
            "run олдсонгүй (core repo-ийн PROVISION_TOKEN secret тохируулсан эсэхийг шалга)"
          )}
          . Дууссаны дараа хуудсыг сэргээхэд «Идэвхтэй» болно.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Бүртгэл, гэрээ, төлбөр</h2>
          <CustomerEditForm customer={c} />
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Core шинэчлэлт авах</h2>
          <p className="text-sm text-text-2">
            Харилцагчийн repo дээр <code className="text-xs">upstream-sync.yml</code> ажиллаж PR нээнэ. Core одоо{" "}
            <strong>{latest?.tagName ?? "release алга"}</strong>.
          </p>
          <SyncButton slug={slug} defaultRef={latest?.tagName ?? null} />
          {customer.openPulls.length > 0 && (
            <div className="text-sm">
              <div className="mb-1 text-xs text-text-3">Нээлттэй PR</div>
              <ul className="space-y-1">
                {customer.openPulls.map((p) => (
                  <li key={p.number}>
                    <a href={p.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">#{p.number} {p.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-sm">
            <div className="mb-1 text-xs text-text-3">Сүүлийн sync ажиллагаа</div>
            {customer.syncRuns.length === 0 && <p className="text-text-3">—</p>}
            <ul className="space-y-1">
              {customer.syncRuns.map((run) => (
                <li key={run.id} className="flex items-center gap-2">
                  <RunBadge run={run} />
                  <span className="text-text-2">{fmtDate(run.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">GitHub хандах эрх</h2>
          <ul className="space-y-1 text-sm">
            {customer.collaborators.length === 0 && <li className="text-text-3">—</li>}
            {customer.collaborators.map((col) => (
              <li key={col.login} className="flex items-center gap-2">
                <a href={col.htmlUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">{col.login}</a>
                <span className="badge badge-muted">{col.permission}</span>
                {col.pending && <span className="badge badge-warning">урилга хүлээгдэж байна</span>}
              </li>
            ))}
          </ul>
          <InviteForm slug={slug} />
          <p className="hint">Харилцагчийн IT-д Write хангалттай (Claude Code push хийнэ). Нягтлан, захиралд GitHub хэрэггүй.</p>
        </section>

        <section className="card space-y-3 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Түүх</h2>
          <NoteForm slug={slug} />
          <ul className="divide-y divide-border text-sm">
            {customer.events.map((e) => (
              <li key={e.id} className="flex gap-3 py-2">
                <span className="w-36 shrink-0 text-xs text-text-3">{fmtDate(e.createdAt.toISOString())}</span>
                <span className="badge badge-muted">{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="text-text-2">{e.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
