"use client";

import type { ColDef } from "ag-grid-community";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { CAMPAIGN_STATUS_LABELS, type SaasCampaign } from "@/lib/saas-emails";

const href = (row: SaasCampaign) => `/emails/${row.id}`;

function StatusBadge({ status }: { status: string }) {
  const meta = CAMPAIGN_STATUS_LABELS[status];
  return <span className={`badge ${meta?.badge ?? "badge-muted"}`}>{meta?.label ?? status}</span>;
}

const COLUMNS: ColDef<SaasCampaign>[] = [
  { headerName: "Огноо", field: "createdAt", minWidth: 150, sort: "desc", valueFormatter: ({ value }) => fmtDate(value) },
  { headerName: "Гарчиг", field: "subject", minWidth: 220, flex: 3 },
  { headerName: "Төлөв", field: "status", minWidth: 120, cellRenderer: ({ data }: { data?: SaasCampaign }) => (data ? <StatusBadge status={data.status} /> : null) },
  { headerName: "Илгээсэн", field: "sentCount", minWidth: 100, type: "numericColumn" },
  { headerName: "Алдаатай", field: "failedCount", minWidth: 100, type: "numericColumn" },
  { headerName: "Алгассан", field: "skippedCount", minWidth: 100, type: "numericColumn" },
];

export function CampaignsGrid({ rows }: { rows: SaasCampaign[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.id}
      rowHref={href}
      ariaLabel="Илгээлтүүд"
      card={(row) => ({
        title: row.subject,
        corner: fmtDate(row.createdAt, false),
        badges: <StatusBadge status={row.status} />,
        meta: `илгээсэн ${row.sentCount} · алдаатай ${row.failedCount} · алгассан ${row.skippedCount}`,
      })}
    />
  );
}
