"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { describeConnection } from "@/lib/saas-ai-accountant";
import {
  describeSaasDeadline,
  SAAS_STATUS_BADGE,
  SAAS_STATUS_LABELS,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";

const href = (row: SaasSubscriptionRow) => `/subscriptions/${row.organizationId}`;
const toneClass = (tone: string) => (tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-2");

function StatusBadge({ row }: { row: SaasSubscriptionRow }) {
  return <span className={`badge ${SAAS_STATUS_BADGE[row.status] ?? "badge-muted"}`}>{SAAS_STATUS_LABELS[row.status] ?? row.status}</span>;
}

function Connection({ row }: { row: SaasSubscriptionRow }) {
  const c = describeConnection(row);
  return <span className={c.tone === "warning" ? "text-warning" : ""}>{c.text}</span>;
}

// Захиалагч = хувь хүн (нэг байгууллага = нэг хэрэглэгч) тул и-мэйл нь гол танигдахуун, нэр нь дэд мөр.
const COLUMNS: ColDef<SaasSubscriptionRow>[] = [
  {
    headerName: "Хэрэглэгч",
    field: "ownerEmail",
    minWidth: 240,
    flex: 2,
    cellClass: "cell-stack",
    tooltipValueGetter: ({ data }) => (data ? [data.ownerEmail, data.orgName].filter(Boolean).join(" · ") : null),
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        <>
          <Link href={href(data)} className="truncate font-medium hover:underline">{data.ownerEmail ?? data.orgName}</Link>
          <span className="truncate text-text-3">{data.orgName}</span>
        </>
      ) : null,
  },
  { headerName: "Төлөв", field: "status", minWidth: 140, cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => (data ? <StatusBadge row={data} /> : null) },
  {
    headerName: "Хугацаа",
    colId: "deadline",
    minWidth: 170,
    valueGetter: ({ data }) => (data ? describeSaasDeadline(data).text : ""),
    tooltipValueGetter: ({ data }) =>
      data
        ? [data.trialEndsAt && `Trial дуусах: ${data.trialEndsAt}`, data.currentPeriodEnd && `Төлсөн хугацаа: ${data.currentPeriodEnd}`].filter(Boolean).join(" · ") || null
        : null,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const d = describeSaasDeadline(data);
      return <span className={`truncate ${toneClass(d.tone)}`}>{d.text}</span>;
    },
  },
  {
    headerName: "Холболт",
    field: "oauthConnections",
    minWidth: 120,
    tooltipValueGetter: ({ data }) => (data?.lastConnectorUseAt ? `Сүүлд ашигласан: ${fmtDate(data.lastConnectorUseAt)}` : "ChatGPT / Claude-оос холбоогүй"),
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => (data ? <Connection row={data} /> : null),
  },
  {
    headerName: "Уншилт · 30 хоног",
    field: "knowledgeReads30d",
    minWidth: 140,
    type: "rightAligned",
    tooltipValueGetter: ({ data }) => (data?.lastKnowledgeReadAt ? `Сүүлд уншсан: ${fmtDate(data.lastKnowledgeReadAt)}` : null),
    valueFormatter: ({ value }) => (value ? String(value) : "—"),
  },
  {
    headerName: "Сүүлд ашигласан",
    colId: "lastUsed",
    minWidth: 150,
    valueGetter: ({ data }) => data?.lastKnowledgeReadAt ?? data?.lastConnectorUseAt ?? null,
    valueFormatter: ({ value }) => (value ? fmtDate(value as string) : "—"),
  },
  { headerName: "Бүртгүүлсэн", field: "createdAt", minWidth: 120, sort: "desc", valueFormatter: ({ value }) => fmtDate(value as string, false) },
];

export function AiAccountantGrid({ rows }: { rows: SaasSubscriptionRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.organizationId}
      rowHref={href}
      rowHeight={54}
      ariaLabel="AI нягтлангийн захиалагчид"
      card={(row) => {
        const d = describeSaasDeadline(row);
        return {
          title: row.ownerEmail ?? row.orgName,
          subtitle: row.orgName,
          corner: <Connection row={row} />,
          badges: <StatusBadge row={row} />,
          meta: (
            <>
              {d.text !== "—" ? <><span className={toneClass(d.tone)}>{d.text}</span> · </> : null}
              уншилт {row.knowledgeReads30d || "—"}
            </>
          ),
        };
      }}
    />
  );
}
