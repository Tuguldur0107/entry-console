// CustomerSummary → хүснэгтийн plain мөр (server → client хил: Date, DB
// мөрийг бүтнээр дамжуулахгүй — зөвхөн хүснэгтэд хэрэгтэй талбар).
import type { CustomerGridRow } from "@/components/grids/customers-grid";

import type { CustomerSummary } from "./customers";

export function toCustomerGridRow({ customer: c, repo, health, behind, lastSync }: CustomerSummary, latestTag: string | null): CustomerGridRow {
  return {
    id: c.id,
    slug: c.slug,
    name: c.displayName,
    repo: repo?.fullName ?? c.githubRepo,
    status: c.status,
    plan: c.plan,
    monthlyFee: Number(c.monthlyFee),
    health,
    behind,
    latestTag,
    lastSync,
    autoSync: c.autoSync,
    upstreamAccess: c.upstreamAccess,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    createdAt: c.createdAt.toISOString(),
  };
}
