import Link from "next/link";

import { AiAccountantGrid } from "@/components/grids/ai-accountant-grid";
import { EmptyState, FilterChips, Kpi, PageHeader, SearchForm, Section, fmtMnt } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listSaasSubscriptions, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import { AI_ACCOUNTANT_FILTERS, AI_ACCOUNTANT_KINDS, filterAiAccountantRows, summarizeAiAccountant } from "@/lib/saas-ai-accountant";
import type { SaasSubscriptionRow } from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI нягтлан" };

export default async function AiAccountantPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; kind?: string }>;
}) {
  await requireSession();
  const { status = "", q = "", kind = "" } = await searchParams;

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
  const visible = filterAiAccountantRows(rows, { status, q, kind });
  const buildHref = (next: { status?: string; kind?: string }) => {
    const params = { status, kind, q, ...next };
    return `/ai-accountant?${new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]).toString()}`;
  };
  // KPI-ийн туршилт / төлсөн / холбоогүй нь «AI нягтлан» багцынх тул paid төрөлд үсэрнэ.
  const chipHref = (value: string) => buildHref({ status: value });
  const paidHref = (value: string) => buildHref({ status: value, kind: "paid" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI нягтлан"
        sub="ChatGPT / Claude-даа Монголын нягтлан бодох мэдлэгийг холбосон бүх хүн: «AI нягтлан» багцын төлбөртэй захиалагчид (29,000₮/сар, 24 цагийн туршилт) ба Entry-ийн багцад үнэгүй багтсан, холбосон эсвэл ашиглаж эхэлсэн байгууллагууд."
      >
        <Link href="/subscriptions/payments" className="btn btn-sm">QPay төлбөрүүд</Link>
        <Link href="/subscriptions" className="btn btn-sm">SaaS байгууллагууд</Link>
      </PageHeader>

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Туршилтад" value={String(summary.trialing)} sub="төлбөртэй · 24 цагийн үнэгүй" href={paidHref("trialing")} />
        <Kpi label="Төлсөн" value={String(summary.paid)} sub={`${summary.pastDue} хугацаа дууссан (grace)`} tone={summary.pastDue ? "warning" : undefined} href={paidHref("active")} />
        <Kpi
          label="Сарын орлого"
          value={fmtMnt(summary.mrrMnt)}
          sub={summary.mrrUnknown ? `${summary.mrrUnknown} дүн тодорхойгүй` : "төлсөн захиалгаас"}
          tone={summary.mrrUnknown ? "warning" : undefined}
          href="/subscriptions/payments"
        />
        <Kpi label="Холбоогүй" value={String(summary.unconnected)} sub="төлбөртэй ч ChatGPT / Claude холбоогүй" tone={summary.unconnected ? "warning" : undefined} href={paidHref("unconnected")} />
        <Kpi label="Үнэгүй ашиглагч" value={String(summary.freeTotal)} sub={`Entry багцтай · ${summary.freeActive30d} нь 30 хоногт уншсан`} href={buildHref({ kind: "free", status: "" })} />
        <Kpi label="Ашигласан · 30 хоног" value={String(summary.activeUsers30d)} sub={`нийт ${summary.total} · ${summary.readOnly} хаалттай`} href={buildHref({ kind: "", status: "" })} />
      </div>

      <Section title="Ашиглагчид" sub={`${visible.length} / ${summary.total} · и-мэйл, нэрээр хайна; мөр дээр дарахад дэлгэрэнгүй (төлбөр, холболт, дэмжлэгийн хандалт)`}>
        <div className="mb-4 space-y-3">
          <SearchForm q={q} placeholder="И-мэйл, нэр…" hidden={{ status, kind }} className="max-w-md" />
          <FilterChips
            active={kind}
            items={AI_ACCOUNTANT_KINDS.map((option) => ({
              value: option.value,
              label: option.label,
              href: buildHref({ kind: option.value }),
              count: filterAiAccountantRows(rows, { status, kind: option.value, q: "" }).length,
            }))}
          />
          <FilterChips
            active={status}
            items={AI_ACCOUNTANT_FILTERS.map((filter) => ({
              value: filter.value,
              label: filter.label,
              href: chipHref(filter.value),
              count: filterAiAccountantRows(rows, { status: filter.value, kind, q: "" }).length,
            }))}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={summary.total === 0 ? "Ашиглагч алга" : "Шүүлтүүрт таарах ашиглагч алга"}
            sub={
              summary.total === 0 && !error
                ? "app.entry.mn/register?plan=skills-ээр бүртгүүлсэн хүн, мөн ChatGPT / Claude-даа холбосон Entry-ийн байгууллага бүр энд гарна."
                : undefined
            }
          />
        ) : (
          <AiAccountantGrid rows={visible} />
        )}
      </Section>

      <Section title="Урсгал, дүрэм" sub="core: docs/knowledge/00-proposal.md D2′ · docs/billing/00-proposal.md §6a">
        <ul className="list-disc space-y-1 pl-4 text-xs text-text-3">
          <li><b>Төлбөртэй: бүртгэл</b> → 24 цагийн туршилт → app.entry.mn дээр QPay-ээр төлөх → ChatGPT / Claude-оос «Connect» дарж Entry-ийн и-мэйл, нууц үгээр холбоно (token хуулахгүй).</li>
          <li><b>Туршилт / төлсөн хугацаа дууссан</b> → 3 хоногийн grace, дараа нь <b>Хаалттай</b>: мэдлэгийн сан хариулахаа больж, «сунгана уу» гэж хэлнэ. Дахин төлбөл шууд нээгдэнэ.</li>
          <li><b>Холбоогүй</b> — төлсөн ч ChatGPT / Claude-даа холбоогүй хүн: онбордингийн саад, холбоо барьж туслах хэрэгтэй.</li>
          <li>Энэ багц нягтлан бодох СИСТЕМД орох эрхгүй (зөвхөн мэдлэгийн сан + MCP). Систем хэрэгтэй болбол «SaaS байгууллагууд»-аас багцыг нь солино.</li>
          <li><b>Үнэгүй</b> — Entry-ийн нягтлан бодох багц бүрд мэдлэгийн сан багтдаг (app.entry.mn → Тохиргоо → AI холболт → «AI нягтлан — үнэгүй»). Энд зөвхөн ChatGPT / Claude-оо холбосон эсвэл сангаас уншсан байгууллага гарна; ашиглаагүй нь «SaaS байгууллагууд»-д. Байгууллагад унтраах: override <code>{"{\"features\":{\"knowledge\":false}}"}</code>.</li>
          <li>Уншилтын квот 200 / 24 цаг (core `KNOWLEDGE_DAILY_READ_LIMIT`) — хэтэрвэл AI-д «[KNOWLEDGE_LIMIT]» буцна.</li>
        </ul>
      </Section>
    </div>
  );
}
