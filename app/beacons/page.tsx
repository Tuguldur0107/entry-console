import Link from "next/link";

import { EmptyState, Kpi, PageHeader, Section, fmtAgo } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { beacons, customers, type BeaconVerdict } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VERDICT: Record<BeaconVerdict, { label: string; cls: string }> = {
  healthy: { label: "Хэвийн", cls: "badge-success" },
  mismatch: { label: "Домэйн зөрүү", cls: "badge-warning" },
  leaked: { label: "Код алдагдсан", cls: "badge-danger" },
  unknown: { label: "Бүртгэлгүй", cls: "badge-danger" },
};

export default async function BeaconsPage() {
  await requireSession();

  const rows = await db
    .select({ b: beacons, customerSlug: customers.slug, customerName: customers.displayName })
    .from(beacons)
    .leftJoin(customers, eq(beacons.matchedCustomerId, customers.id))
    .orderBy(desc(beacons.lastSeenAt))
    .limit(200);

  // Сэжигтэй = сэрэмжлүүлсэн (production, локал биш) instance. Локал/dev
  // дохио доорх "бүх дохио"-нд л харагдана — худал дохио үүсгэхгүй.
  const suspicious = rows.filter((r) => r.b.verdict !== "healthy" && r.b.alertedAt);
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-3">
                  <th className="py-2 pr-3 font-medium">Төлөв</th>
                  <th className="py-2 pr-3 font-medium">Эх (харилцагч / slug)</th>
                  <th className="py-2 pr-3 font-medium">Домэйн</th>
                  <th className="py-2 pr-3 font-medium">Гарал үүсэл</th>
                  <th className="py-2 pr-3 font-medium">IP</th>
                  <th className="py-2 pr-3 font-medium">Сүүлд</th>
                </tr>
              </thead>
              <tbody>
                {suspicious.map(({ b, customerSlug, customerName }) => {
                  const v = VERDICT[b.verdict];
                  const who =
                    customerName ?? b.licenseSlug ?? b.originSlug ?? "танигдаагүй";
                  return (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="py-2 pr-3"><span className={`badge ${v.cls}`}>{v.label}</span></td>
                      <td className="py-2 pr-3">
                        {customerSlug ? (
                          <Link href={`/customers/${customerSlug}`} className="hover:underline">{who}</Link>
                        ) : (
                          who
                        )}
                      </td>
                      <td className="py-2 pr-3 mono text-text-2">{b.appUrl ?? "—"}</td>
                      <td className="py-2 pr-3 mono text-text-3">
                        {b.originSlug ? `тэмдэг: ${b.originSlug}` : b.licensedUrl ? `лиценз: ${b.licensedUrl}` : "—"}
                      </td>
                      <td className="py-2 pr-3 mono text-text-3">{b.ip ?? "—"}</td>
                      <td className="py-2 pr-3 text-text-3">{fmtAgo(b.lastSeenAt)}{b.hitCount > 1 ? ` · ${b.hitCount}×` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Бүх дохио" sub={`Сүүлийн ${rows.length} instance`}>
        {rows.length === 0 ? (
          <EmptyState title="Дохио хараахан алга" sub="Deployment-үүд шинэ хувилбар аваад асахад энд харагдана." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-3">
                  <th className="py-2 pr-3 font-medium">Төлөв</th>
                  <th className="py-2 pr-3 font-medium">Домэйн</th>
                  <th className="py-2 pr-3 font-medium">Харилцагч</th>
                  <th className="py-2 pr-3 font-medium">Хувилбар</th>
                  <th className="py-2 pr-3 font-medium">Орчин</th>
                  <th className="py-2 pr-3 font-medium">Сүүлд</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ b, customerSlug, customerName }) => {
                  const v = VERDICT[b.verdict];
                  return (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="py-2 pr-3"><span className={`badge ${v.cls}`}>{v.label}</span></td>
                      <td className="py-2 pr-3 mono text-text-2">{b.appUrl ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {customerSlug ? <Link href={`/customers/${customerSlug}`} className="hover:underline">{customerName}</Link> : (b.licenseSlug ?? b.originSlug ?? "—")}
                      </td>
                      <td className="py-2 pr-3 mono text-text-3">{b.version ?? "—"}</td>
                      <td className="py-2 pr-3 text-text-3">{b.nodeEnv ?? "—"}</td>
                      <td className="py-2 pr-3 text-text-3">{fmtAgo(b.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
