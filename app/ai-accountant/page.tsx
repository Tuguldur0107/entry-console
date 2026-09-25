import Link from "next/link";

import { AiAccountantGrid } from "@/components/grids/ai-accountant-grid";
import { EmptyState, FilterChips, Kpi, PageHeader, SearchForm, Section, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listSaasSubscriptions, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import { AI_ACCOUNTANT_FILTERS, filterAiAccountantRows, summarizeAiAccountant } from "@/lib/saas-ai-accountant";
import type { SaasSubscriptionRow } from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI нягтлан" };

export default async function AiAccountantPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireSession();
  const { status = "", q = "" } = await searchParams;

  let rows: SaasSubscriptionRow[] = [];
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      rows = await listSaasSubscriptions();
    } catch (caught) {
      error = caught instanceof SaasApiError ? caught.message : caught instanceof Error ? caught.message : String(caught);
    }
  }
  const summary = summarizeAiAccountant(rows);
  const visible = filterAiAccountantRows(rows, { status, q });
  const chipHref = (value: string) =>
    `/ai-accountant?${new URLSearchParams({ ...(value ? { status: value } : {}), ...(q ? { q } : {}) }).toString()}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI нягтлан"
        sub="Систем ашиглахгүй, зөвхөн ChatGPT / Claude-даа Монголын нягтлан бодох мэдлэгийг холбосон захиалагчид (29,000₮/сар, 24 цагийн туршилт). Entry-ийн байгууллагуудад мэдлэгийн сан үнэгүй багтдаг тул тэд энд ОРОХГҮЙ."
      >
        <Link href="/subscriptions/payments" className="btn btn-sm">QPay төлбөрүүд</Link>
        <Link href="/subscriptions" className="btn btn-sm">SaaS байгууллагууд</Link>
      </PageHeader>

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Туршилтад" value={String(summary.trialing)} sub="24 цагийн үнэгүй" href={chipHref("trialing")} />
        <Kpi label="Төлсөн" value={String(summary.paid)} sub={`${summary.pastDue} хугацаа дууссан (grace)`} tone={summary.pastDue ? "warning" : undefined} href={chipHref("active")} />
        <Kpi
          label="Сарын орлого"
          value={fmtMnt(summary.mrrMnt)}
          sub={summary.mrrUnknown ? `${summary.mrrUnknown} дүн тодорхойгүй` : "төлсөн захиалгаас"}
          tone={summary.mrrUnknown ? "warning" : undefined}
          href="/subscriptions/payments"
        />
        <Kpi label="Холбоогүй" value={String(summary.unconnected)} sub="идэвхтэй ч ChatGPT / Claude холбоогүй" tone={summary.unconnected ? "warning" : undefined} href={chipHref("unconnected")} />
        <Kpi label="Ашигласан · 30 хоног" value={String(summary.activeUsers30d)} sub={`${summary.readOnly} хаалттай`} href={chipHref("")} />
      </div>

      <Section title="Захиалагчид" sub={`${visible.length} / ${summary.total} · и-мэйл, нэрээр хайна; мөр дээр дарахад дэлгэрэнгүй (төлбөр, холболт, дэмжлэгийн хандалт)`}>
        <div className="mb-4 space-y-3">
          <SearchForm q={q} placeholder="И-мэйл, нэр…" hidden={{ status }} className="max-w-md" />
          <FilterChips
            active={status}
            items={AI_ACCOUNTANT_FILTERS.map((filter) => ({
              value: filter.value,
              label: filter.label,
              href: chipHref(filter.value),
              count: filterAiAccountantRows(rows, { status: filter.value, q: "" }).length,
            }))}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={summary.total === 0 ? "Захиалагч алга" : "Шүүлтүүрт таарах захиалагч алга"}
            sub={summary.total === 0 && !error ? "app.entry.mn/register?plan=skills-ээр бүртгүүлсэн хүн бүр энд гарна." : undefined}
          />
        ) : (
          <AiAccountantGrid rows={visible} />
        )}
      </Section>

      <Section title="Урсгал, дүрэм" sub="core: docs/knowledge/00-proposal.md D2′ · docs/billing/00-proposal.md §6a">
        <ul className="list-disc space-y-1 pl-4 text-xs text-text-3">
          <li><b>Бүртгэл</b> → 24 цагийн туршилт → app.entry.mn дээр QPay-ээр төлөх → ChatGPT / Claude-оос «Connect» дарж Entry-ийн и-мэйл, нууц үгээр холбоно (token хуулахгүй).</li>
          <li><b>Туршилт / төлсөн хугацаа дууссан</b> → 3 хоногийн grace, дараа нь <b>Хаалттай</b>: мэдлэгийн сан хариулахаа больж, «сунгана уу» гэж хэлнэ. Дахин төлбөл шууд нээгдэнэ.</li>
          <li><b>Холбоогүй</b> — төлсөн ч ChatGPT / Claude-даа холбоогүй хүн: онбордингийн саад, холбоо барьж туслах хэрэгтэй.</li>
          <li>Энэ багц нягтлан бодох СИСТЕМД орох эрхгүй (зөвхөн мэдлэгийн сан + MCP). Систем хэрэгтэй болбол «SaaS байгууллагууд»-аас багцыг нь солино.</li>
          <li>Уншилтын квот 200 / 24 цаг (core `KNOWLEDGE_DAILY_READ_LIMIT`) — хэтэрвэл AI-д «[KNOWLEDGE_LIMIT]» буцна.</li>
        </ul>
      </Section>
    </div>
  );
}
