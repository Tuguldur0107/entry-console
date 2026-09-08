import Link from "next/link";
import { notFound } from "next/navigation";

import { AppUrlForm, InviteForm, SyncButton } from "@/components/forms";
import { HealthBadge, RunBadge, fmtDate } from "@/components/status";
import { requireSession } from "@/lib/auth";
import { loadCustomerDetail } from "@/lib/customers";
import { getCustomerRepo } from "@/lib/github";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;
  const repo = await getCustomerRepo(slug);
  if (!repo) notFound();
  const { latest, customer } = await loadCustomerDetail(repo);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-text-3 hover:underline">← Самбар</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{customer.displayName}</h1>
          <HealthBadge health={customer.health} behind={customer.behind} latest={latest?.tagName ?? null} />
        </div>
        <p className="text-sm text-text-3">
          <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">{repo.fullName}</a>
          {" · "}үүссэн {fmtDate(repo.createdAt)}
          {customer.seededRef && ` · seed ${customer.seededRef}`}
          {customer.health?.sha && ` · deploy ${customer.health.sha.slice(0, 7)}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Core шинэчлэлт авах</h2>
          <p className="text-sm text-text-2">
            Харилцагчийн repo дээр <code className="text-xs">upstream-sync.yml</code> ажиллаж{" "}
            <code className="text-xs">upstream-sync/&lt;ref&gt;</code> → main PR нээнэ. Core одоо{" "}
            <strong>{latest?.tagName ?? "release алга"}</strong>.
          </p>
          <SyncButton slug={slug} defaultRef={latest?.tagName ?? null} />
          {customer.openPulls.length > 0 && (
            <div className="text-sm">
              <div className="mb-1 text-xs text-text-3">Нээлттэй PR</div>
              <ul className="space-y-1">
                {customer.openPulls.map((p) => (
                  <li key={p.number}>
                    <a href={p.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      #{p.number} {p.title}
                    </a>
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
          <h2 className="text-sm font-semibold">Хандах эрх</h2>
          <ul className="space-y-1 text-sm">
            {customer.collaborators.map((c) => (
              <li key={c.login} className="flex items-center gap-2">
                <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">{c.login}</a>
                <span className="badge badge-muted">{c.permission}</span>
                {c.pending && <span className="badge badge-warning">урилга хүлээгдэж байна</span>}
              </li>
            ))}
          </ul>
          <InviteForm slug={slug} />
          <p className="hint">
            Харилцагчийн IT-д Write хангалттай (Claude Code push хийнэ). Нягтлан, захиралд GitHub хэрэггүй.
          </p>
        </section>

        <section className="card space-y-3 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Deploy</h2>
          {customer.health && !customer.health.ok && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              /api/health хүрэхгүй: {customer.health.error ?? "unknown"}
            </p>
          )}
          <AppUrlForm slug={slug} appUrl={customer.appUrl} displayName={customer.displayName} />
        </section>
      </div>
    </div>
  );
}
