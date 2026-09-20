import Link from "next/link";

import { PlanPricesForm } from "@/components/plan-prices-form";
import { PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listPlanPrices, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import type { SaasPlanPrices } from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Багцын үнэ" };

export default async function PlanPricingPage() {
  await requireSession();

  let prices: SaasPlanPrices = {};
  let defaults: SaasPlanPrices = {};
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      ({ prices, defaults } = await listPlanPrices());
    } catch (caught) {
      error = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Багцын үнэ"
        sub="SaaS багц бүрийн суудлын үнэ. Энд тогтоосон үнэ БҮХ харилцагчид үйлчилнэ; тусдаа тохирсон харилцагч нь өөрийн хуудсан дээрх «Тусгай үнэ»-ээр дарна."
      >
        <Link href="/subscriptions" className="btn btn-sm">← Багцууд</Link>
      </PageHeader>

      <Section
        title="Суудлын үнэ"
        sub="Хоосон = үнэ тогтоогоогүй (хэлэлцээрээр) — 0₮ гэсэн үг БИШ. Үнэгүй болгох бол 0 гэж бич."
      >
        {error ? (
          // Одоогийн үнэ уншигдаагүй үед ФОРМ ГАРГАХГҮЙ — хоосон талбараар
          // хадгалбал бүх үнэ «хэлэлцээрээр» болж бодит үнэ алдагдана.
          <>
            <p className="notice notice-danger" role="alert">{error}</p>
            <p className="mt-3 text-xs text-text-3">
              Одоогийн үнэ уншигдаагүй тул засварын форм түр хаалттай — санамсаргүй хоослохоос сэргийлж байна.
              Холболт сэргээд хуудсыг дахин ачаална уу.
            </p>
          </>
        ) : (
          <PlanPricesForm prices={prices} defaults={defaults} />
        )}
      </Section>

      <Section title="Үнэ хаанаас уншигдах вэ" sub="core: docs/billing/00-proposal.md §5">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-text-3">
          <li><b>Кодын default</b> (`lib/billing/plans.ts`) — зөвхөн шинэ хувилбар гаргахад өөрчлөгдөнө.</li>
          <li><b>Энэ хуудас</b> — платформ даяар нэг үнэ, deploy шаардахгүй.</li>
          <li><b>Харилцагчийн тусгай үнэ</b> — багцын хуудасны «Тусгай үнэ» талбар, дээрх хоёрыг дардаг.</li>
        </ol>
        <p className="mt-3 text-xs text-text-3">
          Сарын дүн = төлсөн суудал × үнэ. Суудал эсвэл үнэ дутуу бол дүн бодогдохгүй —
          MRR-т орохгүй бөгөөд «дүн тодорхойгүй» гэж тоологдоно (тоо зохиохгүй).
        </p>
      </Section>
    </div>
  );
}
