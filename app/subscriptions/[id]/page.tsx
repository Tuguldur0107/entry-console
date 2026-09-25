import Link from "next/link";
import { notFound } from "next/navigation";

import { BillingPaymentsGrid } from "@/components/grids/billing-payments-grid";
import { MembersGrid } from "@/components/grids/members-grid";
import { SaasOrgDangerZone } from "@/components/saas-org-danger";
import { SupportAccessSection } from "@/components/support-access";
import { SubscriptionForm } from "@/components/subscription-form";
import { fmtDate, fmtMnt, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  getSaasOrgDetail,
  getSaasSubscription,
  listSaasBillingPayments,
  saasApiConfigured,
  SaasApiError,
} from "@/lib/saas-api";
import {
  byMemberRole,
  isOrgActive,
  moduleLabel,
  profileGaps,
  type SaasOrgDetail,
} from "@/lib/saas-orgs";
import { paidAmountOf, type SaasBillingPayment } from "@/lib/saas-billing";
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
        <PageHeader title="Байгууллага" />
        <p className="notice notice-danger">ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.</p>
      </div>
    );

  let row;
  let detail: SaasOrgDetail | null = null;
  let detailError: string | null = null;
  try {
    row = await getSaasSubscription(id);
  } catch (caught) {
    const message = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    return (
      <div className="space-y-4">
        <PageHeader title="Байгууллага" />
        <p className="notice notice-danger">{message}</p>
        <Link href="/subscriptions" className="btn btn-sm">← Жагсаалт</Link>
      </div>
    );
  }
  if (!row) notFound();

  // Дэлгэрэнгүй нь core-ийн ШИНЭ зам — унших боломжгүй бол багцын хэсэг
  // хэвээр ажиллана (хилийн цэгцлэлт: Console түрүүлж deploy хийгдэж болно).
  try {
    detail = await getSaasOrgDetail(id);
  } catch (caught) {
    detailError = caught instanceof Error ? caught.message : String(caught);
  }
  // QPay төлбөр — core-ийн хуучин хувилбарт зам байхгүй бол хоосон (алдаа биш).
  let payments: SaasBillingPayment[] = [];
  let paymentsError: string | null = null;
  try {
    payments = await listSaasBillingPayments({ organizationId: id, limit: 50 });
  } catch (caught) {
    paymentsError = caught instanceof Error ? caught.message : String(caught);
  }
  const paidTotal = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + paidAmountOf(p), 0);

  const deadline = describeSaasDeadline(row);
  const seats = describeSaasSeats(row);
  const members = detail ? [...detail.members].sort(byMemberRole) : [];
  const gaps = detail ? profileGaps(detail) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.orgName}
        sub={
          <>
            <span className="mono">{row.registryNo ?? "ТТД —"}</span> · эзэн {row.ownerEmail ?? "—"} ·{" "}
            {row.memberCount} гишүүн · бүртгэсэн {row.createdAt}
            {detail?.lastActivityAt ? <> · сүүлийн үйлдэл {fmtDate(detail.lastActivityAt)}</> : null}
          </>
        }
      >
        <Link href="/subscriptions" className="btn btn-sm">← Жагсаалт</Link>
      </PageHeader>

      {detailError ? <p className="notice notice-warning">Дэлгэрэнгүй уншигдсангүй: {detailError}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Section
            title="Багц засах"
            sub="Хадгалахад core сервис дээрх organization_subscriptions мөр шинэчлэгдэж, апп тэр даруй дагана."
          >
            <SubscriptionForm row={row} />
          </Section>

          {detail ? (
            <Section
              title="Дэмжлэгийн хандалт"
              sub="Линк 15 минут хүчинтэй · орсны дараа сесс 1 цаг · орох, гарах бүр харилцагчийн аудитад бичигдэж эзэн/админд и-мэйл очно."
            >
              <SupportAccessSection
                organizationId={detail.organizationId}
                orgName={detail.name}
                defaultEmail={config.supportEmail}
                sessions={detail.supportSessions}
              />
            </Section>
          ) : null}

          <Section
            title="QPay төлбөр"
            sub={payments.length ? `${payments.length} нэхэмжлэх · нийт төлсөн ${fmtMnt(paidTotal)}` : "Багцаа app.entry.mn дээр өөрөө төлсөн түүх"}
          >
            {paymentsError ? (
              <p className="notice notice-warning">{paymentsError}</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-text-3">Төлбөр хийгээгүй.</p>
            ) : (
              <BillingPaymentsGrid rows={payments} showOrg={false} />
            )}
          </Section>

          {detail ? (
            <Section title="Гишүүд" sub={`${members.length} хэрэглэгч`}>
              {members.length === 0 ? (
                <p className="text-sm text-text-3">Гишүүн алга.</p>
              ) : (
                <MembersGrid members={members} />
              )}
            </Section>
          ) : null}

          <Section title="Аюултай бүс" sub="Туршилтын эсвэл гэрээ дууссан байгууллагыг core сервисээс цэвэрлэх">
            <SaasOrgDangerZone organizationId={row.organizationId} orgName={row.orgName} memberCount={row.memberCount} />
          </Section>
        </div>

        {/* Утсан дээр төлөв ЭХЭНД (ихэвчлэн харах гэж нээдэг), десктопод баруун баганад */}
        <div className="order-first space-y-4 lg:order-none">
          <Section
            title="Одоогийн төлөв"
            sub={row.hasRow ? `Сүүлд шинэчилсэн ${fmtDate(row.updatedAt)}` : "Тохиргооны мөргүй — default-оор ажиллаж байна"}
          >
            <dl className="space-y-2 text-sm">
              <Row label="Багц">{SAAS_PLAN_LABELS[row.planId] ?? row.planId}</Row>
              <Row label="Статус">
                <span className={`badge ${SAAS_STATUS_BADGE[row.status] ?? "badge-muted"}`}>
                  {SAAS_STATUS_LABELS[row.status] ?? row.status}
                </span>
              </Row>
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
              <Row label="Хугацаа">
                <span className={deadline.tone === "danger" ? "text-danger" : deadline.tone === "warning" ? "text-warning" : ""}>
                  {deadline.text}
                </span>
              </Row>
              {row.readOnlyReason ? <Row label="Шалтгаан">{row.readOnlyReason}</Row> : null}
            </dl>
          </Section>

          {detail ? (
            <Section
              title="Тохиргооны төлөв"
              sub={isOrgActive(detail) ? "Бодит бичилттэй байгууллага" : "Бичилт хийгдээгүй байна"}
            >
              <dl className="space-y-2 text-sm">
                <Row label="НӨАТ төлөгч">
                  {detail.settings.isVatPayer === null ? (
                    <span className="text-text-3">тохируулаагүй</span>
                  ) : detail.settings.isVatPayer ? (
                    "Тийм"
                  ) : (
                    "Үгүй"
                  )}
                </Row>
                <Row label="POS">{detail.settings.posEnabled ? "Тохируулсан" : "—"}</Row>
                <Row label="eBarimt">
                  {detail.settings.ebarimtEnabled ? (
                    <span className="badge badge-success">Асаалттай</span>
                  ) : (
                    <span className="text-text-3">—</span>
                  )}
                </Row>
                <Row label="Унтраасан модуль">
                  {detail.disabledModules.length === 0 ? (
                    <span className="text-text-3">байхгүй</span>
                  ) : (
                    detail.disabledModules.map(moduleLabel).join(", ")
                  )}
                </Row>
                <Row label="AI батлах хязгаар">
                  {detail.profile?.aiPostLimitMnt == null ? (
                    <span className="text-text-3">default (10 сая ₮)</span>
                  ) : (
                    fmtMnt(detail.profile.aiPostLimitMnt)
                  )}
                </Row>
                <Row label="Илгээгч домэйн">
                  {detail.profile?.invoiceFromEmail ? (
                    <>
                      <span className="mono">{detail.profile.invoiceFromEmail}</span>
                      {detail.profile.emailDomainVerified ? null : (
                        <span className="ml-1 text-xs text-warning">баталгаажаагүй</span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-3">env default</span>
                  )}
                </Row>
                <Row label="Дутуу мэдээлэл">
                  {gaps.length === 0 ? (
                    <span className="badge badge-success">Бүрэн</span>
                  ) : (
                    <span className="text-warning">{gaps.join(", ")}</span>
                  )}
                </Row>
              </dl>
            </Section>
          ) : null}

          {detail ? (
            <Section title="Хэрэглээ" sub={detail.usage.lastClosedPeriod ? `Сүүлд хаасан ${detail.usage.lastClosedPeriod}` : "Сар хаагаагүй"}>
              <dl className="space-y-2 text-sm">
                <Row label="Журнал">{detail.usage.journalVouchers}</Row>
                <Row label="АР/АП баримт">{detail.usage.arApDocuments}</Row>
                <Row label="Харилцагч">{detail.usage.counterparties}</Row>
                <Row label="Бараа">{detail.usage.inventoryItems}</Row>
                <Row label="Мөнгөн данс">{detail.usage.cashAccounts}</Row>
                <Row label="Үндсэн хөрөнгө">{detail.usage.fixedAssets}</Row>
                <Row label="Ажилтан">{detail.usage.employees}</Row>
                <Row label="API token">{detail.usage.apiTokens}</Row>
                <Row label="Хаагдсан сар">{detail.usage.closedPeriods}</Row>
              </dl>
            </Section>
          ) : null}

          {detail?.aiAccountant ? (
            <Section title="AI нягтлан" sub="Мэдлэгийн сан + ChatGPT / Claude холболт">
              <dl className="space-y-2 text-sm">
                <Row label="Уншилт (30 хоног)">{detail.aiAccountant.knowledgeReads30d}</Row>
                <Row label="Сүүлд уншсан">{fmtDate(detail.aiAccountant.lastKnowledgeReadAt)}</Row>
                <Row label="Холболт (OAuth)">
                  {detail.aiAccountant.oauthConnections === 0 ? (
                    <span className="text-warning">холбоогүй</span>
                  ) : (
                    detail.aiAccountant.oauthConnections
                  )}
                </Row>
                <Row label="Сүүлд ашигласан">{fmtDate(detail.aiAccountant.lastConnectorUseAt)}</Row>
              </dl>
            </Section>
          ) : null}

        </div>
      </div>

      {/* Утсан дээр маягтын ДАРАА (төлөвийн багана эхэнд гардаг тул) */}
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
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-text-3">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}
