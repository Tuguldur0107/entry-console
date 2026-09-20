import Link from "next/link";

import {
  AddPlanPriceForm,
  CurrentPricesTable,
  PlanPriceHistory,
} from "@/components/plan-prices-form";
import { PageHeader, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listPlanPrices, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import type { SaasPlanPricePeriod, SaasPlanPrices } from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Багцын үнэ" };

export default async function PlanPricingPage() {
  await requireSession();

  let prices: SaasPlanPrices = {};
  let defaults: SaasPlanPrices = {};
  let periods: SaasPlanPricePeriod[] = [];
  let today = new Date().toISOString().slice(0, 10);
  let error: string | null = null;
  if (!saasApiConfigured()) error = "ENTRY_SAAS_API_URL / ENTRY_SAAS_API_KEY тохируулаагүй.";
  else {
    try {
      ({ prices, defaults, periods, today } = await listPlanPrices());
    } catch (caught) {
      error = caught instanceof SaasApiError || caught instanceof Error ? caught.message : String(caught);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Багцын үнэ"
        sub="SaaS багц бүрийн суудлын үнэ, мөрдөх хугацаатайгаа. Энд тогтоосон үнэ БҮХ харилцагчид үйлчилнэ; тусдаа тохирсон харилцагч нь өөрийн хуудсан дээрх «Тусгай үнэ»-ээр дарна."
      >
        <Link href="/subscriptions" className="btn btn-sm">← Багцууд</Link>
      </PageHeader>

      {error ? (
        <>
          <p className="notice notice-danger" role="alert">{error}</p>
          <p className="text-xs text-text-3">
            Одоогийн үнэ уншигдаагүй тул засварын хэсэг түр хаалттай — санамсаргүй өөрчлөхөөс сэргийлж байна.
            Холболт сэргээд хуудсыг дахин ачаална уу.
          </p>
        </>
      ) : (
        <>
          <Section
            title="Өнөөдрийн үнэ"
            sub={`${today} — багц бүрд тухайн өдрийг хамрах үе үйлчилнэ; үе байхгүй бол кодын default.`}
          >
            <CurrentPricesTable periods={periods} prices={prices} defaults={defaults} today={today} />
          </Section>

          <Section
            title="Шинэ үнэ нэмэх"
            sub="Хэзээнээс мөрдөхийг заана. Хугацаагүй үнэ дээр шинэ үнэ хожуу эхлэвэл өмнөх нь автоматаар өмнөх өдрөөр хаагдана."
          >
            <AddPlanPriceForm today={today} />
          </Section>

          <Section title="Үнийн түүх" sub="Анх тогтоосон үнэ, дараагийн шинэчлэлт, ирээдүйн үнэ бүгд энд.">
            <PlanPriceHistory periods={periods} today={today} />
          </Section>
        </>
      )}

      <Section title="Үнэ хаанаас уншигдах вэ" sub="core: docs/billing/00-proposal.md §5">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-text-3">
          <li><b>Кодын default</b> (`lib/billing/plans.ts`) — зөвхөн шинэ хувилбар гаргахад өөрчлөгдөнө.</li>
          <li><b>Энэ хуудас</b> — платформ даяар нэг үнэ, мөрдөх хугацаатай; deploy шаардахгүй.</li>
          <li><b>Харилцагчийн тусгай үнэ</b> — багцын хуудасны «Тусгай үнэ» талбар, дээрх хоёрыг дардаг.</li>
        </ol>
        <p className="mt-3 text-xs text-text-3">
          Тухайн өдрийг хамрах үе байхгүй бол (цоорхой, эсвэл эхний үеэс өмнөх өдөр) кодын default мөрдөнө —
          үнэ зохиогдохгүй. Сарын дүн = төлсөн суудал × үнэ. Суудал эсвэл үнэ дутуу бол дүн бодогдохгүй —
          MRR-т орохгүй бөгөөд «дүн тодорхойгүй» гэж тоологдоно (тоо зохиохгүй).
        </p>
      </Section>
    </div>
  );
}
