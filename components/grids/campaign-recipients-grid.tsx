"use client";

import type { ColDef } from "ag-grid-community";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { RECIPIENT_STATUS_LABELS, eventLabel, type SaasCampaignRecipient } from "@/lib/saas-emails";

function StatusBadge({ row }: { row: SaasCampaignRecipient }) {
  const meta = RECIPIENT_STATUS_LABELS[row.status];
  return (
    <span className={`badge ${meta?.badge ?? "badge-muted"}`} title={row.error ?? undefined}>
      {meta?.label ?? row.status}
    </span>
  );
}

function EventBadge({ row }: { row: SaasCampaignRecipient }) {
  const event = eventLabel(row.lastEvent);
  return event ? <span className={`badge ${event.badge}`}>{event.label}</span> : <span className="text-text-3">—</span>;
}

const COLUMNS: ColDef<SaasCampaignRecipient>[] = [
  { headerName: "И-мэйл", field: "email", minWidth: 200, flex: 2, cellClass: "mono", pinned: "left" },
  { headerName: "Байгууллага", field: "orgName", minWidth: 160, flex: 2, valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Илгээлт", field: "status", minWidth: 120, cellRenderer: ({ data }: { data?: SaasCampaignRecipient }) => (data ? <StatusBadge row={data} /> : null) },
  { headerName: "Хүргэлт", field: "lastEvent", minWidth: 130, cellRenderer: ({ data }: { data?: SaasCampaignRecipient }) => (data ? <EventBadge row={data} /> : null) },
  { headerName: "Шалгасан", field: "lastCheckedAt", minWidth: 140, valueFormatter: ({ value }) => fmtDate(value) },
  { headerName: "Алдаа", field: "error", minWidth: 180, flex: 2, valueFormatter: ({ value }) => value ?? "" },
];

export function CampaignRecipientsGrid({ rows }: { rows: SaasCampaignRecipient[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.email}
      rowHref={(row) => (row.organizationId ? `/subscriptions/${row.organizationId}` : null)}
      ariaLabel="Хүлээн авагчид"
      card={(row) => ({
        title: row.email,
        subtitle: row.orgName,
        badges: (
          <>
            <StatusBadge row={row} />
            <EventBadge row={row} />
          </>
        ),
        meta: row.error ?? undefined,
      })}
    />
  );
}
