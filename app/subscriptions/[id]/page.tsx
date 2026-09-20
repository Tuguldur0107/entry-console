import Link from "next/link";
import { notFound } from "next/navigation";

import { SubscriptionForm } from "@/components/subscription-form";
import { fmtDate, fmtMnt, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getSaasSubscription, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  describeSaasDeadline,
  describeSaasSeats,
  SAAS_PLAN_LABELS,
  SAAS_STATUS_BADGE,
  SAAS_STATUS_LABELS,
} from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  if (!saasApiConfigured())
    return (
      <div className="space-y-4">
        <PageHeader title="SaaS багц" />
        <p className="notice notice-danger">ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.</p>
      </div>
    );
  let row;
  try {
    row = await getSaasSubscription(id);
  } catch (caught) {
    const message = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    return (
      <div className="space-y-4">
        <PageHeader title="SaaS багц" />
        <p className="notice notice-danger">{message}</p>
        <Link href="/subscriptions" className="btn btn-sm">← Жагсаалт</Link>
      </div>
    );
  }
  if (!row) notFound();

  const deadline = describeSaasDeadline(row);
  const seats = describeSaasSeats(row);

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.orgName}
        sub={
          <>
            <span className="mono">{row.registryNo ?? "ТТД —"}</span> · эзэн {row.ownerEmail ?? "—"} · {row.memberCount} гишүүн · бүртгэсэн {row.createdAt}
          </>
        }
      >
        <Link href="/subscriptions" className="btn btn-sm">← Жагсаалт</Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Багц засах" sub="Хадгалахад core сервис дээрх organization_subscriptions мөр шинэчлэгдэж, апп тэр даруй дагана.">
          <SubscriptionForm row={row} />
        </Section>

        <div className="space-y-4">
          <Section title="Одоогийн төлөв" sub={row.hasRow ? `Сүүлд шинэчилсэн ${fmtDate(row.updatedAt)}` : "Тохиргооны мөргүй — default-оор ажиллаж байна"}>
            <dl className="space-y-2 text-sm">
              <Row label="Багц">{SAAS_PLAN_LABELS[row.planId] ?? row.planId}</Row>
              <Row label="Статус"><span className={`badge ${SAAS_STATUS_BADGE[row.status] ?? "badge-muted"}`}>{SAAS_STATUS_LABELS[row.status] ?? row.status}</span></Row>
              <Row label="Үнэ / суудал">
                {row.pricePerSeatMnt === null ? (
                  <span className="text-text-3">хэлэлцээрээр</span>
                ) : (
                  <>
                    {fmtMnt(row.pricePerSeatMnt)}
                    {row.pricePerSeatOverrideMnt !== null ? (
                      <span className="ml-1 text-xs text-warning">тусгай</span>
                    ) : null}
                  </>
                )}
              </Row>
              <Row label="Сарын дүн">
                {row.monthlyAmountMnt === null ? <span className="text-text-3">—</span> : fmtMnt(row.monthlyAmountMnt)}
              </Row>
              <Row label="Суудал"><span className={seats.over ? "text-danger font-medium" : ""}>{seats.text}</span></Row>
              <Row label="Бичих эрх">
                {row.writable ? <span className="badge badge-success">Нээлттэй</span> : <span className="badge badge-danger">Зөвхөн унших</span>}
              </Row>
              <Row label="Хугацаа"><span className={deadline.tone === "danger" ? "text-danger" : deadline.tone === "warning" ? "text-warning" : ""}>{deadline.text}</span></Row>
              {row.readOnlyReason ? <Row label="Шалтгаан">{row.readOnlyReason}</Row> : null}
            </dl>
          </Section>
          <Section title="Дүрэм" sub="core: docs/billing/00-proposal.md">
            <ul className="list-disc space-y-1 pl-4 text-xs text-text-3">
              <li>Trial 14 хоног — дуусахад зөвхөн унших; <b>Идэвхтэй</b> + багц сонговол нээгдэнэ.</li>
              <li><b>Төлбөр хоцорсон</b> → 14 хоногийн grace (үе дуусах огнооноос), дараа нь зөвхөн унших.</li>
              <li><b>Түр зогсоосон / Цуцлагдсан</b> → тэр даруй зөвхөн унших (өгөгдөл устахгүй).</li>
              <li>Суудал хоосон = багцын default; урилга суудлаас хэтэрвэл апп татгалзана.</li>
              <li>overrides: <span className="mono">{`{"features":{"api.rest":true},"limits":{"companies":3}}`}</span> — багцаас ялгаатай хэсэг л.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-3">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
