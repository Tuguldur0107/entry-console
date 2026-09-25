"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtMnt } from "@/components/ui";
import {
  describeSaasDeadline,
  describeSaasSeats,
  SAAS_PLAN_LABELS,
  SAAS_STATUS_BADGE,
  SAAS_STATUS_LABELS,
  type SaasSubscriptionRow,
} from "@/lib/saas-subscriptions";

const href = (row: SaasSubscriptionRow) => `/subscriptions/${row.organizationId}`;
const toneClass = (tone: string) => (tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-2");

function StatusBadge({ row }: { row: SaasSubscriptionRow }) {
  return <span className={`badge ${SAAS_STATUS_BADGE[row.status] ?? "badge-muted"}`}>{SAAS_STATUS_LABELS[row.status] ?? row.status}</span>;
}

function Price({ row }: { row: SaasSubscriptionRow }) {
  if (row.pricePerSeatMnt === null) return <span className="text-text-3">хэлэлцээрээр</span>;
  return (
    <>
      {fmtMnt(row.pricePerSeatMnt)}
      {row.pricePerSeatOverrideMnt !== null ? <span className="ml-1 text-xs text-warning">тусгай</span> : null}
    </>
  );
}

const COLUMNS: ColDef<SaasSubscriptionRow>[] = [
  {
    headerName: "Байгууллага",
    field: "orgName",
    pinned: "left",
    minWidth: 190,
    flex: 2,
    cellClass: "cell-stack",
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        <>
          <Link href={href(data)} className="truncate font-medium hover:underline">{data.orgName}</Link>
          <span className="mono truncate text-text-3" title={data.hasRow ? undefined : "Багцын мөргүй — trial/standard-ийн default-оор ажиллаж байна"}>
            {data.registryNo ?? "ТТД —"}{data.hasRow ? "" : " · тохиргоогүй"}
          </span>
        </>
      ) : null,
  },
  { headerName: "Статус", field: "status", minWidth: 150, cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => (data ? <StatusBadge row={data} /> : null) },
  {
    headerName: "Хугацаа",
    colId: "deadline",
    minWidth: 135,
    // Эрэмбэ: зөвхөн унших → цөөн хоног үлдсэн → хугацаагүй
    valueGetter: ({ data }) => (!data ? 0 : !data.writable ? -1 : data.daysLeft ?? 9999),
    tooltipValueGetter: ({ data }) => (data ? [data.trialEndsAt && `Trial дуусах: ${data.trialEndsAt}`, data.currentPeriodEnd && `Үе дуусах: ${data.currentPeriodEnd}`].filter(Boolean).join(" · ") || null : null),
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const d = describeSaasDeadline(data);
      return <span className={`truncate ${toneClass(d.tone)}`}>{d.text}</span>;
    },
  },
  { headerName: "Багц", field: "planId", minWidth: 115, tooltipValueGetter: ({ value }) => SAAS_PLAN_LABELS[value as SaasSubscriptionRow["planId"]] ?? value, valueFormatter: ({ value }) => SAAS_PLAN_LABELS[value as SaasSubscriptionRow["planId"]] ?? value },
  {
    headerName: "Суудал",
    colId: "seats",
    minWidth: 95,
    valueGetter: ({ data }) => data?.seatsUsed ?? 0,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const s = describeSaasSeats(data);
      return <span className={s.over ? "font-medium text-danger" : ""} title={s.over ? "Төлсөн суудлаас хэтэрсэн" : undefined}>{s.text}</span>;
    },
  },
  {
    headerName: "Үнэ · сарын дүн",
    field: "monthlyAmountMnt",
    minWidth: 130,
    type: "rightAligned",
    cellClass: "cell-stack cell-stack-end",
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        <>
          <span><Price row={data} /></span>
          <span className="text-xs text-text-3">{data.monthlyAmountMnt === null ? "сарын дүн —" : `${fmtMnt(data.monthlyAmountMnt)} / сар`}</span>
        </>
      ) : null,
  },
  {
    headerName: "Эзэн",
    field: "ownerEmail",
    minWidth: 150,
    tooltipField: "ownerEmail",
    cellClass: "cell-stack",
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        <>
          <span className="truncate">{data.ownerEmail ?? "—"}</span>
          <span className="text-xs text-text-3">{data.memberCount} гишүүн</span>
        </>
      ) : null,
  },
];

export function SubscriptionsGrid({ rows }: { rows: SaasSubscriptionRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.organizationId}
      rowHref={href}
      rowHeight={54}
      ariaLabel="SaaS байгууллагууд"
      card={(row) => {
        const d = describeSaasDeadline(row);
        return {
          title: row.orgName,
          subtitle: row.ownerEmail ?? row.registryNo,
          corner: row.monthlyAmountMnt === null ? null : <span className="font-medium text-text-2">{fmtMnt(row.monthlyAmountMnt)}/сар</span>,
          badges: (
            <>
              <StatusBadge row={row} />
              {/* «Туршилт · Туршилт» давхардуулахгүй */}
              {row.planId === "trial" && row.status === "trialing" ? null : (
                <span className="badge badge-muted badge-plain">{SAAS_PLAN_LABELS[row.planId] ?? row.planId}</span>
              )}
            </>
          ),
          meta: (
            <>
              {d.text !== "—" ? <><span className={toneClass(d.tone)}>{d.text}</span> · </> : null}суудал {describeSaasSeats(row).text}
            </>
          ),
        };
      }}
    />
  );
}
