import { OntologyHistoryGrid, OntologyStatusGrid, type OntologyHistoryRow, type OntologyStatusRow } from "@/components/grids/ontology-grid";
import { OntologyReportSettingsForm } from "@/components/forms";
import { EmptyState, fmtDate, Kpi, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { alertChannels } from "@/lib/notify";
import { nextScheduledAt, reportDetail, targetStatus, WEEKDAY_LABELS, type OntologyTargetResult } from "@/lib/ontology-report";
import { collectOntologyStatus, getReportSettings, listReports } from "@/lib/ontology-report-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ontology тайлан" };

export default async function OntologyPage() {
  await requireSession();
  const [live, settings, history] = await Promise.all([collectOntologyStatus(), getReportSettings(), listReports(30)]);
  const channels = alertChannels();
  const now = new Date();

  const statusRows: OntologyStatusRow[] = live.targets.map((t) => ({
    key: t.url,
    name: t.name,
    url: t.url,
    slug: t.slug,
    version: t.version,
    ...targetStatus(t),
  }));
  const historyRows: OntologyHistoryRow[] = history.map((r) => {
    const targets = (Array.isArray(r.data) ? r.data : []) as OntologyTargetResult[];
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      trigger: r.trigger,
      last7d: r.last7d,
      attention: r.attention,
      deployments: targets.length,
      detail: reportDetail(targets),
      notified: r.notified,
    };
  });
  const enforced = live.targets.filter((t) => (t.ontology?.enforce.length ?? 0) > 0).length;
  const withData = live.targets.filter((t) => t.ontology?.violations).length;
  const schedule = settings.enabled
    ? `${WEEKDAY_LABELS[settings.weekday]} гараг бүр ${String(settings.hour).padStart(2, "0")}:00 (УБ) · дараагийнх ${fmtDate(nextScheduledAt(settings, now))}`
    : "унтраалттай";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ontology тайлан"
        sub="Core-ийн deployment бүрийн /api/health → бүртгэлгүй төлвийн шилжилт (ажиглах trigger). 0 хэдэн долоо хоног үргэлжилбэл ONTOLOGY_ENFORCE-ээр мөрдөх горимд шилжинэ."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="7 хоногийн зөрчил" value={String(live.last7d)} tone={live.last7d ? "warning" : "success"} sub={`${withData}/${live.targets.length} deployment тоо өгсөн`} />
        <Kpi label="Анхаарах" value={String(live.attention)} tone={live.attention ? "danger" : undefined} sub="зөрчилтэй, хүрэхгүй, env алдаа" />
        <Kpi label="Мөрдөх горимд" value={`${enforced}/${live.targets.length}`} sub="ONTOLOGY_ENFORCE тавьсан" />
        <Kpi label="Хуваарь" value={settings.enabled ? "Асаалттай" : "Унтраалттай"} tone={settings.enabled ? "success" : "warning"} sub={settings.enabled ? `${WEEKDAY_LABELS[settings.weekday]} ${String(settings.hour).padStart(2, "0")}:00` : undefined} />
      </div>

      <Section title="Одоогийн төлөв" sub="Хуудас нээх бүрд шинээр татна (хадгалахгүй, илгээхгүй)">
        {statusRows.length === 0 ? (
          <EmptyState title="Deployment алга" sub="ENTRY_SAAS_API_URL тавих эсвэл идэвхтэй харилцагч (app хаягтай) нэмэхэд энд харагдана." />
        ) : (
          <OntologyStatusGrid rows={statusRows} />
        )}
      </Section>

      <Section title="Хуваарь, мэдэгдэл" sub={`Хяналтын cron (5 мин тутам) хуваарийн цаг болмогц нэг удаа гаргана · ${schedule}`}>
        <div className="mb-3 flex gap-2 text-sm">
          <span className={`check-dot ${channels.length ? "check-ok" : "check-warn"}`}>{channels.length ? "✓" : "!"}</span>
          <span>Мэдэгдлийн суваг: {channels.length ? channels.join(", ") : "алга — TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID эсвэл ALERT_WEBHOOK_URL тавина (тайлан хадгалагдсаар)"}</span>
        </div>
        <OntologyReportSettingsForm settings={settings} />
      </Section>

      <Section title="Тайлангийн түүх" sub={`Сүүлийн ${historyRows.length} тайлан`}>
        {historyRows.length === 0 ? (
          <EmptyState title="Тайлан хараахан гараагүй" sub="Хуваарийн цаг болох эсвэл «Одоо гаргаж илгээх» дарахад энд хадгалагдана." />
        ) : (
          <OntologyHistoryGrid rows={historyRows} />
        )}
      </Section>
    </div>
  );
}
