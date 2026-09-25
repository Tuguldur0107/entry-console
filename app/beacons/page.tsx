import { BeaconsGrid, type BeaconGridRow } from "@/components/grids/beacons-grid";
import { EmptyState, Kpi, PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { beacons, customers } from "@/lib/db/schema";
import { ensureSchema } from "@/lib/db/ensure";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";


export default async function BeaconsPage() {
  await requireSession();
  await ensureSchema();

  const rows = await db
    .select({ b: beacons, customerSlug: customers.slug, customerName: customers.displayName })
    .from(beacons)
    .leftJoin(customers, eq(beacons.matchedCustomerId, customers.id))
    .orderBy(desc(beacons.lastSeenAt))
    .limit(200);

  // Сэжигтэй = сэрэмжлүүлсэн (production, локал биш) instance. Локал/dev
  // дохио доорх "бүх дохио"-нд л харагдана — худал дохио үүсгэхгүй.
  const suspicious = rows.filter((r) => r.b.verdict !== "healthy" && r.b.alertedAt);
  const toRow = ({ b, customerSlug, customerName }: (typeof rows)[number]): BeaconGridRow => ({
    id: b.id,
    verdict: b.verdict,
    appUrl: b.appUrl,
    customerSlug,
    customerName,
    who: customerName ?? b.licenseSlug ?? b.originSlug ?? "танигдаагүй",
    origin: b.originSlug ? `тэмдэг: ${b.originSlug}` : b.licensedUrl ? `лиценз: ${b.licensedUrl}` : null,
    ip: b.ip,
    version: b.version,
    nodeEnv: b.nodeEnv,
    lastSeenAt: b.lastSeenAt.toISOString(),
    hitCount: b.hitCount,
  });
  const counts = {
    healthy: rows.filter((r) => r.b.verdict === "healthy").length,
    mismatch: rows.filter((r) => r.b.verdict === "mismatch").length,
    leaked: rows.filter((r) => r.b.verdict === "leaked").length,
    unknown: rows.filter((r) => r.b.verdict === "unknown").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Илрүүлэлт (Beacon)"
        sub="Deployment бүр асахдаа Console руу дохио өгдөг. Зөвшөөрөлгүй хуулбарыг ЭНД илрүүлнэ — устгах биш, мэдэх зорилготой."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Хэвийн instance" value={String(counts.healthy)} tone="success" />
        <Kpi label="Домэйн зөрүү" value={String(counts.mismatch)} tone={counts.mismatch ? "warning" : undefined} />
        <Kpi label="Код алдагдсан" value={String(counts.leaked)} tone={counts.leaked ? "danger" : undefined} />
        <Kpi label="Бүртгэлгүй" value={String(counts.unknown)} tone={counts.unknown ? "danger" : undefined} />
      </div>

      <Section
        title="Сэрэмжлүүлэг шаардсан instance"
        sub={`${suspicious.length} анхаарах · лицензгүй, домэйн зөрсөн, эсвэл танигдаагүй`}
      >
        {suspicious.length === 0 ? (
          <EmptyState title="Цэвэр — сэжигтэй instance алга" sub="Бүх дохио лицензтэй, домэйндоо ажиллаж байна." />
        ) : (
          <BeaconsGrid suspicious rows={suspicious.map(toRow)} />
        )}
      </Section>

      <Section title="Бүх дохио" sub={`Сүүлийн ${rows.length} instance`}>
        {rows.length === 0 ? (
          <EmptyState title="Дохио хараахан алга" sub="Deployment-үүд шинэ хувилбар аваад асахад энд харагдана." />
        ) : (
          <BeaconsGrid rows={rows.map(toRow)} />
        )}
      </Section>
    </div>
  );
}
