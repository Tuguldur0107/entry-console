import { ProvisionForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { getLatestRelease } from "@/lib/github";

export const dynamic = "force-dynamic";
export const metadata = { title: "Харилцагч нэмэх" };

export default async function NewCustomerPage() {
  await requireSession();
  const latest = await getLatestRelease().catch(() => null);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Харилцагч нэмэх" sub="Нэг маягт — бүртгэл, багц, техник тохиргоо. Дарсны дараа repo 1 минутад бэлэн болно." />
      <ProvisionForm latestTag={latest?.tagName ?? null} owner={config.owner} />
      <div className="card mt-6 p-5 text-sm text-text-2">
        <h2 className="card-title mb-2">Дараа нь юу болох вэ</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Core repo дээр <span className="mono">provision-customer.yml</span> ажиллаж repo, тохиргоо, урилгыг хийнэ — харилцагчийн хуудаснаас явцыг харна.</li>
          <li>Railway → New service → тэр repo → <span className="mono">DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL</span>.</li>
          <li>Deploy хаягийг харилцагчийн хуудсанд хадгалахад хувилбарын хяналт ажиллана.</li>
          <li>Харилцагч вэбээр бүртгүүлж, Cowork-оор master data оруулна (docs/deployment).</li>
        </ol>
      </div>
    </div>
  );
}
