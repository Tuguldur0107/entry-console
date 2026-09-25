"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { AutoSyncBadge, HealthBadge, PLAN_LABELS, RunBadge, StatusBadge, fmtDate, fmtMnt } from "@/components/ui";
import type { CustomerPlan, CustomerStatus } from "@/lib/db/schema";
import type { Health, WorkflowRun } from "@/lib/github";

/** Server хуудас `toCustomerGridRow`-оор бэлдэнэ — Date биш, зөвхөн plain утга. */
export type CustomerGridRow = {
  id: string;
  slug: string;
  name: string;
  repo: string;
  status: CustomerStatus;
  plan: CustomerPlan;
  monthlyFee: number;
  health: Health | null;
  behind: boolean | null;
  latestTag: string | null;
  lastSync: WorkflowRun | null;
  autoSync: boolean;
  upstreamAccess: boolean;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: string;
};

const href = (row: CustomerGridRow) => `/customers/${row.slug}`;

const nameCol: ColDef<CustomerGridRow> = {
  headerName: "Харилцагч",
  field: "name",
  pinned: "left",
  minWidth: 200,
  flex: 2,
  cellClass: "cell-stack",
  cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
    data ? (
      <>
        <Link href={href(data)} className="font-medium hover:underline">{data.name}</Link>
        <span className="mono truncate text-text-3">{data.repo}</span>
      </>
    ) : null,
};

const statusCol: ColDef<CustomerGridRow> = {
  headerName: "Төлөв",
  field: "status",
  minWidth: 125,
  cellRenderer: ({ data }: { data?: CustomerGridRow }) => (data ? <StatusBadge status={data.status} /> : null),
};

const deployCol: ColDef<CustomerGridRow> = {
  headerName: "Deploy",
  colId: "deploy",
  minWidth: 115,
  // Эрэмбэлэхэд: хүрэхгүй → хоцорсон → хэвийн → хаяггүй
  valueGetter: ({ data }) => (!data?.health ? 3 : !data.health.ok ? 0 : data.behind ? 1 : 2),
  cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
    !data ? null : NO_DEPLOY.includes(data.status) ? <span className="text-text-3">—</span> : <HealthBadge health={data.health} behind={data.behind} latest={data.latestTag} />,
};

const syncCol: ColDef<CustomerGridRow> = {
  headerName: "Сүүлийн sync",
  colId: "sync",
  minWidth: 115,
  valueGetter: ({ data }) => data?.lastSync?.createdAt ?? "",
  cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
    data?.lastSync ? <RunBadge run={data.lastSync} /> : <span className="text-text-3">—</span>,
};

const feeCol: ColDef<CustomerGridRow> = {
  headerName: "Төлбөр / сар",
  field: "monthlyFee",
  minWidth: 115,
  type: "rightAligned",
  valueFormatter: ({ value }) => (Number(value) > 0 ? fmtMnt(value) : "—"),
};

const planFeeCol: ColDef<CustomerGridRow> = {
  headerName: "Багц · төлбөр",
  field: "monthlyFee",
  minWidth: 120,
  cellClass: "cell-stack",
  cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
    data ? (
      <>
        <span>{PLAN_LABELS[data.plan]}</span>
        {data.monthlyFee > 0 ? <span className="text-xs text-text-3">{fmtMnt(data.monthlyFee)}/сар</span> : null}
      </>
    ) : null,
};

/** Хүсэлт/татгалзсан/архив — deploy байх ёсгүй тул «хаяг алга» гэж шуугиулахгүй. */
const NO_DEPLOY: CustomerStatus[] = ["pending", "rejected", "archived"];

const COLUMNS: ColDef<CustomerGridRow>[] = [
  nameCol,
  statusCol,
  deployCol,
  syncCol,
  {
    headerName: "Авто sync",
    colId: "autoSync",
    minWidth: 95,
    valueGetter: ({ data }) => (data ? `${data.autoSync ? 1 : 0}${data.upstreamAccess ? 1 : 0}` : ""),
    cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
      data ? <AutoSyncBadge on={data.autoSync} access={data.upstreamAccess} status={data.status} /> : null,
  },
  planFeeCol,
  {
    headerName: "Холбоо барих",
    field: "contactName",
    minWidth: 120,
    cellClass: "cell-stack",
    cellRenderer: ({ data }: { data?: CustomerGridRow }) =>
      data ? (
        <>
          <span>{data.contactName ?? "—"}</span>
          {data.contactPhone ? <span className="text-xs text-text-3">{data.contactPhone}</span> : null}
        </>
      ) : null,
  },
  { headerName: "Үүссэн", field: "createdAt", minWidth: 95, sort: "desc", valueFormatter: ({ value }) => fmtDate(value, false) },
];

/** Самбарын товч хувилбар — нарийн баганад багтах гол 4 багана (sync нь «Анхаарах»-д). */
const COMPACT: ColDef<CustomerGridRow>[] = [nameCol, statusCol, deployCol, feeCol];

export function CustomersGrid({ rows, compact = false }: { rows: CustomerGridRow[]; compact?: boolean }) {
  return (
    <DataGrid
      rows={rows}
      columns={compact ? COMPACT : COLUMNS}
      getRowId={(row) => row.id}
      rowHref={href}
      rowHeight={54}
      ariaLabel="Харилцагчид"
      card={(row) => ({
        title: row.name,
        subtitle: row.repo,
        corner: Number(row.monthlyFee) > 0 ? <span className="font-medium text-text-2">{fmtMnt(row.monthlyFee)}/сар</span> : fmtDate(row.createdAt, false),
        badges: (
          <>
            <StatusBadge status={row.status} />
            {NO_DEPLOY.includes(row.status) ? null : <HealthBadge health={row.health} behind={row.behind} latest={row.latestTag} />}
            {row.status === "active" ? <AutoSyncBadge on={row.autoSync} access={row.upstreamAccess} status={row.status} /> : null}
          </>
        ),
        meta: [PLAN_LABELS[row.plan], row.contactName, row.contactPhone].filter(Boolean).join(" · "),
      })}
    />
  );
}
