import { ProvisionForm } from "@/components/forms";
import { requireSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { getLatestRelease } from "@/lib/github";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireSession();
  const latest = await getLatestRelease();
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Харилцагч нэмэх</h1>
        <p className="text-sm text-text-3">
          Бүртгэл энд хадгалагдаж, {config.owner}/{config.repoPrefix}&lt;код&gt; private repo core-ийн бүтэн
          түүхтэй үүсч, upstream-sync тохиргоо + GitHub урилга автоматаар хийгдэнэ (~1 мин).
        </p>
      </div>
      <div className="card p-5">
        <ProvisionForm latestTag={latest?.tagName ?? null} />
      </div>
      <div className="card p-5 text-sm text-text-2">
        <h2 className="mb-2 text-sm font-semibold text-text-1">Дараа нь гараар</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Railway → New service → GitHub repo (шинэ repo) → DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL</li>
          <li>Deploy дууссаны дараа харилцагчийн хуудсанд «Deploy хаяг» хадгална → хувилбарын самбар ажиллана</li>
          <li>Харилцагч вэбээр бүртгүүлж, Cowork-оор master data оруулна (docs/deployment)</li>
        </ol>
      </div>
    </div>
  );
}
