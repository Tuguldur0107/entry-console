"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { FUNNEL_STAGE_LABELS, stageDate, type FunnelStageKey, type TrialFunnelOrgRow } from "@/lib/saas-insights";

const href = (row: TrialFunnelOrgRow) => `/subscriptions/${row.organizationId}`;
const STAGE_BADGE: Record<FunnelStageKey, string> = {
  signed_up: "badge-muted",
  connected: "badge-info",
  master_data: "badge-info",
  first_journal: "badge-warning",
  paid: "badge-success",
};

function StageBadge({ row }: { row: TrialFunnelOrgRow }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`badge ${STAGE_BADGE[row.lastStage]}`}>{FUNNEL_STAGE_LABELS[row.lastStage]}</span>
      {row.manuallyConverted && row.lastStage !== "paid" ? (
        <span className="badge badge-success" title="Console-оос идэвхтэй багцад шилжүүлсэн (QPay-гүй)">Төлбөртэй · гараар</span>
      ) : null}
    </span>
  );
}

const dateColumn = (key: FunnelStageKey): ColDef<TrialFunnelOrgRow> => ({
  headerName: FUNNEL_STAGE_LABELS[key],
  colId: key,
  minWidth: 130,
  valueGetter: ({ data }) => (data ? stageDate(data, key) ?? "" : ""),
  valueFormatter: ({ value }) => (value ? fmtDate(value as string, false) : "—"),
  cellClass: ({ value }) => (value ? "" : "text-text-4"),
});

export function FunnelOrgsGrid({ rows, stages }: { rows: TrialFunnelOrgRow[]; stages: FunnelStageKey[] }) {
  const columns: ColDef<TrialFunnelOrgRow>[] = [
    {
      headerName: "Байгууллага",
      field: "orgName",
      pinned: "left",
      minWidth: 220,
      flex: 2,
      cellRenderer: ({ data }: { data?: TrialFunnelOrgRow }) =>
        data ? <Link href={href(data)} className="truncate font-medium hover:underline">{data.orgName}</Link> : null,
    },
    {
      headerName: "Хүрсэн алхам",
      field: "lastStage",
      minWidth: 320,
      cellRenderer: ({ data }: { data?: TrialFunnelOrgRow }) => (data ? <StageBadge row={data} /> : null),
    },
    ...stages.map((key) => ({ ...dateColumn(key), ...(key === "signed_up" ? { sort: "desc" as const } : {}) })),
  ];
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.organizationId}
      rowHref={href}
      ariaLabel="Когортын байгууллагууд"
      card={(row) => ({
        title: row.orgName,
        corner: fmtDate(row.createdAt, false),
        badges: <StageBadge row={row} />,
      })}
    />
  );
}
