import Link from "next/link";

import { SubscriptionsGrid } from "@/components/grids/subscriptions-grid";
import { EmptyState, FilterChips, PageHeader, SearchForm, Section } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listSaasSubscriptions, saasApiConfigured, SaasApiError } from "@/lib/saas-api";
import {
  filterSaasRows,
  SAAS_STATUS_LABELS,
  SAAS_STATUSES,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "SaaS багцууд" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Бүгд" },
  ...SAAS_STATUSES.map((status) => ({ value: status, label: SAAS_STATUS_LABELS[status] })),
  { value: "readonly", label: "Зөвхөн унших" },
];

const SETUP_HINT =
  "Railway → entry-console → Variables: ENTRY_SAAS_API_URL = ${{entry-accounting.NEXT_PUBLIC_APP_URL}}, " +
  "ENTRY_SAAS_API_KEY = core-ийн ENTRY_PLATFORM_API_KEY-тэй ижил утга; core талд ENTRY_DEPLOYMENT_MODE=saas.";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; deleted?: string }>;
}) {
  await requireSession();
  const { status = "", q = "", deleted } = await searchParams;

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
  const visible = filterSaasRows(rows, { status, q });

  return (
    <div className="space-y-5">
      <PageHeader
        title="SaaS байгууллагууд"
        sub="Үндсэн SaaS сервис дээрх байгууллага бүр. Нэр дээр дарж дэлгэрэнгүй (багц засах, гишүүд, төлбөр, дэмжлэгийн хандалт, устгах). Тоон үзүүлэлт самбарт."
      >
        <Link href="/subscriptions/payments" className="btn btn-sm">QPay төлбөрүүд</Link>
        <Link href="/subscriptions/pricing" className="btn btn-sm">Багцын үнэ</Link>
      </PageHeader>

      {deleted ? <p className="notice notice-success">«{deleted}» устлаа — core сервисээс бүх бичилт, багцын мөр, гишүүнчлэл хасагдав.</p> : null}
      {error ? (
        <div className="space-y-2">
          <p className="notice notice-danger" role="alert">{error}</p>
          <p className="text-xs text-text-3">{SETUP_HINT}</p>
        </div>
      ) : null}

      <Section title="Байгууллагууд" sub={`${visible.length} / ${rows.length} · нэр, ТТД, эзний и-мэйлээр хайна · давхар даралт → дэлгэрэнгүй`}>
        <div className="mb-4 space-y-3">
          <SearchForm q={q} placeholder="Нэр, ТТД, эзний и-мэйл…" hidden={{ status }} className="max-w-md" />
          <FilterChips
            active={status}
            items={FILTERS.map((filter) => ({
              value: filter.value,
              label: filter.label,
              href: `/subscriptions?${new URLSearchParams({ ...(filter.value ? { status: filter.value } : {}), ...(q ? { q } : {}) }).toString()}`,
              count: filter.value === "" ? rows.length : filterSaasRows(rows, { status: filter.value, q: "" }).length,
            }))}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "Байгууллага алга" : "Шүүлтүүрт таарах байгууллага алга"}
            sub={rows.length === 0 && !error ? "SaaS сервис дээр бүртгүүлсэн байгууллага энд гарна." : undefined}
          />
        ) : (
          <SubscriptionsGrid rows={visible} />
        )}
      </Section>
    </div>
  );
}
