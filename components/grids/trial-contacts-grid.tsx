"use client";

import type { ColDef } from "ag-grid-community";

import { DataGrid, type GridSelection } from "@/components/datagrid/data-grid";
import { fmtDate } from "@/components/ui";
import { eventLabel, isUnsubscribed, type SaasTrialContact } from "@/lib/saas-emails";
import {
  SAAS_PLAN_LABELS,
  SAAS_STATUS_BADGE,
  SAAS_STATUS_LABELS,
  type SaasPlanId,
  type SaasSubscriptionStatus,
} from "@/lib/saas-subscriptions";

const href = (row: SaasTrialContact) => `/subscriptions/${row.organizationId}`;

function SubBadge({ row }: { row: SaasTrialContact }) {
  if (!row.subStatus) return <span className="text-text-3">—</span>;
  const status = row.subStatus as SaasSubscriptionStatus;
  return <span className={`badge ${SAAS_STATUS_BADGE[status] ?? "badge-muted"}`}>{SAAS_STATUS_LABELS[status] ?? row.subStatus}</span>;
}

function DeliveryBadge({ row }: { row: SaasTrialContact }) {
  if (isUnsubscribed(row)) return <span className="badge badge-muted">Татгалзсан</span>;
  if (!row.delivery) return <span className="text-text-3">?</span>;
  const event = eventLabel(row.delivery.lastEvent);
  if (!event) return <span className="badge badge-muted badge-plain">Илгээгээгүй</span>;
  return (
    <span className={`badge ${event.badge}`} title={row.delivery.lastSubject ?? undefined}>
      {event.label}
    </span>
  );
}

const COLUMNS: ColDef<SaasTrialContact>[] = [
  { headerName: "Байгууллага", field: "orgName", minWidth: 180, flex: 2, pinned: "left" },
  { headerName: "И-мэйл", field: "ownerEmail", minWidth: 200, flex: 2, cellClass: "mono" },
  { headerName: "Нэр", field: "ownerName", minWidth: 130, flex: 1.2 },
  {
    headerName: "Баталгаажсан",
    colId: "verified",
    minWidth: 120,
    valueGetter: ({ data }) => (data?.emailVerifiedAt ? 1 : 0),
    cellRenderer: ({ data }: { data?: SaasTrialContact }) =>
      data ? (data.emailVerifiedAt ? <span className="badge badge-success">Тийм</span> : <span className="badge badge-warning">Үгүй</span>) : null,
  },
  {
    headerName: "Багц",
    field: "planId",
    minWidth: 110,
    valueFormatter: ({ value }) => (value ? (SAAS_PLAN_LABELS[value as SaasPlanId] ?? value) : "—"),
  },
  { headerName: "Төлөв", colId: "sub", field: "subStatus", minWidth: 120, cellRenderer: ({ data }: { data?: SaasTrialContact }) => (data ? <SubBadge row={data} /> : null) },
  { headerName: "Туршилт дуусах", field: "trialEndsAt", minWidth: 120, valueFormatter: ({ value }) => fmtDate(value, false) },
  { headerName: "Бүртгүүлсэн", field: "orgCreatedAt", minWidth: 120, sort: "desc", valueFormatter: ({ value }) => fmtDate(value, false) },
  { headerName: "Console мэйл", field: "campaignsReceived", minWidth: 110, type: "numericColumn" },
  {
    headerName: "Сүүлийн хүргэлт",
    colId: "delivery",
    minWidth: 140,
    valueGetter: ({ data }) => data?.delivery?.lastAt ?? "",
    cellRenderer: ({ data }: { data?: SaasTrialContact }) => (data ? <DeliveryBadge row={data} /> : null),
  },
];

export function TrialContactsGrid({
  rows,
  selection,
}: {
  rows: SaasTrialContact[];
  selection?: GridSelection<SaasTrialContact>;
}) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.organizationId}
      rowHref={href}
      ariaLabel="Харилцагчид"
      selection={selection}
      card={(row) => ({
        title: row.orgName,
        subtitle: row.ownerEmail,
        corner: fmtDate(row.orgCreatedAt, false),
        badges: (
          <>
            <SubBadge row={row} />
            <DeliveryBadge row={row} />
          </>
        ),
      })}
    />
  );
}
