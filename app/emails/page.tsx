import { CampaignsGrid } from "@/components/grids/campaigns-grid";
import { EmailComposer } from "@/components/email-composer";
import { EmptyState, FilterChips, Kpi, PageHeader, SearchForm, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { listCampaigns, listTrialContacts, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  CONTACT_FILTERS,
  currentTimeMs,
  filterTrialContacts,
  summarizeTrialContacts,
  type SaasCampaign,
  type SaasTrialContactsReport,
} from "@/lib/saas-emails";

export const dynamic = "force-dynamic";
export const metadata = { title: "И-мэйл" };

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireSession();
  const { filter = "", q = "" } = await searchParams;

  let report: SaasTrialContactsReport | null = null;
  let campaigns: SaasCampaign[] = [];
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      [report, campaigns] = await Promise.all([listTrialContacts(), listCampaigns()]);
    } catch (caught) {
      error = caught instanceof SaasApiError ? caught.message : caught instanceof Error ? caught.message : String(caught);
    }
  }
  const contacts = report?.contacts ?? [];
  const now = currentTimeMs();
  const visible = filterTrialContacts(contacts, { filter, q, now });
  const summary = summarizeTrialContacts(contacts);
  const sender = report?.sender;
  const senderReady = sender?.domainStatus === "verified";
  const href = (next: { filter?: string }) => {
    const params = { filter, q, ...next };
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]).toString();
    return `/emails${query ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="И-мэйл" sub={sender?.from ? `Илгээгч: ${sender.from}` : undefined} />

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}
      {report && !senderReady ? (
        <p className="notice notice-danger" role="alert">
          {sender?.domain ?? "Илгээгч"} домэйн Resend дээр баталгаажаагүй ({sender?.domainStatus ?? "тодорхойгүй"}) — илгээх боломжгүй.
        </p>
      ) : null}
      {report && !report.delivery.available && report.delivery.error ? (
        <p className="notice" role="status">Хүргэлтийн төлөв уншигдсангүй: {report.delivery.error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Харилцагч" value={String(summary.total)} href={href({ filter: "" })} />
        <Kpi label="Баталгаажсан" value={String(summary.verified)} href={href({ filter: "verified" })} />
        <Kpi
          label="Мэйл хүрсэн"
          value={summary.reached === null ? "?" : String(summary.reached)}
          sub={summary.failed ? `${summary.failed} алдаатай` : undefined}
          tone={summary.failed ? "warning" : undefined}
        />
        <Kpi label="Console мэйл аваагүй" value={String(summary.neverEmailed)} href={href({ filter: "never_emailed" })} />
        <Kpi label="Татгалзсан" value={String(summary.unsubscribed)} href={href({ filter: "unsubscribed" })} />
      </div>

      <Section title="Харилцагчид" sub={`${visible.length} / ${summary.total}`}>
        <div className="mb-4 space-y-3">
          <SearchForm q={q} placeholder="И-мэйл, нэр, байгууллага…" hidden={{ filter }} className="max-w-md" />
          <FilterChips
            active={filter}
            items={CONTACT_FILTERS.map((option) => ({
              value: option.value,
              label: option.label,
              href: href({ filter: option.value }),
              count: filterTrialContacts(contacts, { filter: option.value, q: "", now }).length,
            }))}
          />
        </div>
        {contacts.length ? (
          <EmailComposer contacts={contacts} visible={visible} defaultTestEmail={config.supportEmail} senderReady={senderReady} />
        ) : (
          <EmptyState title="Харилцагч алга" />
        )}
      </Section>

      <Section title="Илгээлтүүд" sub={`${campaigns.length}`}>
        {campaigns.length ? <CampaignsGrid rows={campaigns} /> : <EmptyState title="Илгээлт алга" />}
      </Section>
    </div>
  );
}
