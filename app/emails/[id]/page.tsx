import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignRecipientsGrid } from "@/components/grids/campaign-recipients-grid";
import { Kpi, PageHeader, Section, fmtDate } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getCampaign, SaasApiError } from "@/lib/saas-api";
import { CAMPAIGN_STATUS_LABELS, type SaasCampaignDetail } from "@/lib/saas-emails";

export const dynamic = "force-dynamic";
export const metadata = { title: "Илгээлт" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let detail: SaasCampaignDetail | null = null;
  let error: string | null = null;
  try {
    // Хуудас нээх бүрд хүргэлтийн төлөвийг Resend-ээс шинэчилнэ (core тал 5 мин тутам, ≤50).
    detail = await getCampaign(id, true);
  } catch (caught) {
    error = caught instanceof SaasApiError ? caught.message : caught instanceof Error ? caught.message : String(caught);
  }
  if (!detail && !error) notFound();

  const recipients = detail?.recipients ?? [];
  const count = (pick: (event: string | null) => boolean) => recipients.filter((r) => pick(r.lastEvent)).length;
  const delivered = count((e) => e === "delivered" || e === "opened" || e === "clicked");
  const opened = count((e) => e === "opened" || e === "clicked");
  const bounced = count((e) => e === "bounced" || e === "failed" || e === "suppressed" || e === "complained");
  const status = detail ? CAMPAIGN_STATUS_LABELS[detail.campaign.status] : null;

  return (
    <div className="space-y-5">
      <PageHeader title={detail?.subject ?? "Илгээлт"} sub={detail ? `${fmtDate(detail.createdAt)} · ${detail.sender}` : undefined}>
        <Link href="/emails" className="btn btn-sm">Буцах</Link>
        <Link href={`/emails/${id}`} className="btn btn-sm">Шинэчлэх</Link>
      </PageHeader>

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}
      {detail?.refreshError ? <p className="notice" role="status">Хүргэлтийн төлөв шинэчлэгдсэнгүй: {detail.refreshError}</p> : null}

      {detail ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Төлөв" value={status?.label ?? detail.campaign.status} />
            <Kpi label="Илгээсэн" value={String(detail.campaign.sentCount)} sub={`${detail.campaign.skippedCount} алгассан`} />
            <Kpi label="Хүрсэн" value={String(delivered)} />
            <Kpi label="Нээсэн" value={String(opened)} />
            <Kpi
              label="Алдаатай"
              value={String(detail.campaign.failedCount + bounced)}
              tone={detail.campaign.failedCount + bounced ? "danger" : undefined}
            />
          </div>

          <Section title="Текст">
            <p className="whitespace-pre-wrap text-sm text-text-2">{detail.body}</p>
          </Section>

          <Section title="Хүлээн авагчид" sub={`${recipients.length}`}>
            <CampaignRecipientsGrid rows={recipients} />
          </Section>
        </>
      ) : null}
    </div>
  );
}
