import { ToolUsageGrid } from "@/components/grids/tool-usage-grid";
import { EmptyState, FilterChips, Kpi, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getAiToolUsage, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import { errorTone, fmtRate, parseDays, RANGE_OPTIONS, rangeForDays, totalWriteAcceptance, type ToolUsageReport } from "@/lib/saas-insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI tool-ийн хэрэглээ" };

export default async function AiToolsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireSession();
  const days = parseDays((await searchParams).days, 30);
  const range = rangeForDays(days);

  let report: ToolUsageReport | null = null;
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      report = await getAiToolUsage(range);
    } catch (caught) {
      error = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    }
  }
  const tone = report ? errorTone(report.totals.errorRate) : null;
  const clipped = report?.countingSince && report.countingSince > range.from;
  const writes = totalWriteAcceptance(report?.tools ?? []);

  return (
    <div className="space-y-5">
      <PageHeader title="AI tool-ийн хэрэглээ" sub={report ? `${report.from} – ${report.to} · ChatGPT / Claude (MCP) ба REST` : undefined} />

      <FilterChips active={String(days)} items={RANGE_OPTIONS.map((d) => ({ value: String(d), label: `${d} хоног`, href: `/ai-tools?days=${d}` }))} />

      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}
      {clipped ? <p className="notice notice-info">Тоолуур {report!.countingSince}-нээс эхэлсэн — түүнээс өмнөх өдөр тоологдоогүй.</p> : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Дуудлага" value={report.totals.calls.toLocaleString("en-US")} sub={`${report.totals.toolsUsed} tool ашигласан`} />
            <Kpi label="Алдааны хувь" value={fmtRate(report.totals.errorRate)} tone={tone ?? undefined} sub={`${report.totals.errors.toLocaleString("en-US")} алдаа`} />
            <Kpi label="Байгууллага" value={String(report.totals.organizations)} sub="AI-аар ажилласан" />
            <Kpi label="Ашиглагдаагүй" value={String(report.unusedTools.length)} tone={report.unusedTools.length ? "warning" : undefined} sub="tools/list-д байгаа ч дуудагдаагүй" />
            <Kpi label="Санал хүлээн авсан" value={fmtRate(writes.rate)} sub={`${writes.suggestions.toLocaleString("en-US")} бичилтийн санал`} />
          </div>

          <Section title="Tool бүрээр" sub="Алдааны код, хугацаа, бичих tool-ийн саналын хувь заяа">
            {report.tools.length === 0 ? <EmptyState title="Энэ хугацаанд дуудлага алга" /> : <ToolUsageGrid rows={report.tools} />}
          </Section>

          {report.unusedTools.length ? (
            <Section title="Ашиглагдаагүй tool" sub="Хасах эсвэл тайлбарыг сайжруулах нэр дэвшигч">
              <details className="group">
                <summary className="cursor-pointer text-sm text-text-2 hover:text-text-1">{report.unusedTools.length} tool харах</summary>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {report.unusedTools.map((name) => (
                    <li key={name} className="badge badge-muted badge-plain mono">{name}</li>
                  ))}
                </ul>
              </details>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
