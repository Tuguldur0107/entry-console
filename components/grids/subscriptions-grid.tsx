"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtDate, fmtMnt } from "@/components/ui";
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

/** Trial / төлбөрийн үеийн ЭЦСИЙН огноо — статусаараа аль нь хамаатайг харуулна. */
function periodEndOf(row: SaasSubscriptionRow): { date: string | null; label: string } {
  if (row.status === "trialing") return { date: row.trialEndsAt, label: "trial" };
  return { date: row.currentPeriodEnd ?? row.trialEndsAt, label: row.currentPeriodEnd ? "үе" : "trial" };
}

const COLUMNS: ColDef<SaasSubscriptionRow>[] = [
  {
    headerName: "Байгууллага",
    field: "orgName",
    pinned: "left",
    minWidth: 220,
    flex: 2,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        <Link href={href(data)} className="truncate font-medium hover:underline" title={data.hasRow ? undefined : "Багцын мөргүй — default-оор ажиллаж байна"}>
          {data.orgName}
          {data.hasRow ? "" : <span className="ml-1 text-xs font-normal text-text-3">· тохиргоогүй</span>}
        </Link>
      ) : null,
  },
  {
    headerName: "ТТД",
    field: "registryNo",
    minWidth: 100,
    maxWidth: 120,
    cellClass: "mono",
    valueFormatter: ({ value }) => (value as string | null) ?? "—",
  },
  { headerName: "Статус", field: "status", minWidth: 140, maxWidth: 170, cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => (data ? <StatusBadge row={data} /> : null) },
  {
    headerName: "Багц",
    field: "planId",
    minWidth: 110,
    maxWidth: 150,
    tooltipValueGetter: ({ value }) => SAAS_PLAN_LABELS[value as SaasSubscriptionRow["planId"]] ?? value,
    valueFormatter: ({ value }) => SAAS_PLAN_LABELS[value as SaasSubscriptionRow["planId"]] ?? value,
  },
  {
    headerName: "Бичих эрх",
    field: "writable",
    minWidth: 110,
    maxWidth: 130,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) =>
      data ? (
        data.writable ? <span className="badge badge-success badge-plain">Нээлттэй</span> : <span className="badge badge-danger badge-plain" title={data.readOnlyReason ?? undefined}>Зөвхөн унших</span>
      ) : null,
  },
  {
    headerName: "Хугацаа",
    colId: "deadline",
    minWidth: 130,
    // Эрэмбэ: зөвхөн унших → цөөн хоног үлдсэн → хугацаагүй
    valueGetter: ({ data }) => (!data ? 0 : !data.writable ? -1 : data.daysLeft ?? 9999),
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const d = describeSaasDeadline(data);
      return <span className={`truncate ${toneClass(d.tone)}`}>{d.text}</span>;
    },
  },
  {
    headerName: "Дуусах огноо",
    colId: "periodEnd",
    minWidth: 130,
    maxWidth: 150,
    valueGetter: ({ data }) => (data ? periodEndOf(data).date ?? "" : ""),
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const end = periodEndOf(data);
      return end.date ? <span className="mono">{end.date} <span className="text-xs text-text-3">{end.label}</span></span> : <span className="text-text-3">—</span>;
    },
  },
  {
    headerName: "Суудал",
    colId: "seats",
    minWidth: 90,
    maxWidth: 110,
    valueGetter: ({ data }) => data?.seatsUsed ?? 0,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      const s = describeSaasSeats(data);
      return <span className={s.over ? "font-medium text-danger" : ""} title={s.over ? "Төлсөн суудлаас хэтэрсэн" : undefined}>{s.text}</span>;
    },
  },
  {
    headerName: "Гишүүд",
    field: "memberCount",
    minWidth: 90,
    maxWidth: 100,
    type: "rightAligned",
  },
  {
    headerName: "Үнэ / суудал",
    field: "pricePerSeatMnt",
    minWidth: 120,
    maxWidth: 160,
    type: "rightAligned",
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => (data ? <Price row={data} /> : null),
  },
  {
    headerName: "Сарын дүн",
    field: "monthlyAmountMnt",
    minWidth: 120,
    maxWidth: 150,
    type: "rightAligned",
    valueFormatter: ({ value }) => (value === null || value === undefined ? "—" : fmtMnt(value as number)),
  },
  {
    headerName: "AI нягтлан",
    colId: "aiAccountant",
    minWidth: 130,
    valueGetter: ({ data }) => (data ? data.oauthConnections * 100_000 + data.knowledgeReads30d : 0),
    tooltipValueGetter: ({ data }) =>
      data
        ? [
            data.lastConnectorUseAt && `Сүүлд холбогч ашигласан: ${fmtDate(data.lastConnectorUseAt)}`,
            data.lastKnowledgeReadAt && `Сүүлд уншсан: ${fmtDate(data.lastKnowledgeReadAt)}`,
          ]
            .filter(Boolean)
            .join(" · ") || null
        : null,
    cellRenderer: ({ data }: { data?: SaasSubscriptionRow }) => {
      if (!data) return null;
      if (!data.oauthConnections && !data.knowledgeReads30d) return <span className="text-text-3">—</span>;
      return (
        <span className="truncate">
          {data.oauthConnections} холболт · {data.knowledgeReads30d} уншилт
        </span>
      );
    },
  },
  {
    headerName: "Эзэн",
    field: "ownerEmail",
    minWidth: 180,
    tooltipField: "ownerEmail",
    valueFormatter: ({ value }) => (value as string | null) ?? "—",
  },
  {
    headerName: "Бүртгэсэн",
    field: "createdAt",
    minWidth: 110,
    maxWidth: 130,
    cellClass: "mono",
  },
  {
    headerName: "Тэмдэглэл",
    field: "note",
    minWidth: 150,
    tooltipField: "note",
    valueFormatter: ({ value }) => (value as string | null) ?? "",
  },
];

export function SubscriptionsGrid({ rows }: { rows: SaasSubscriptionRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.organizationId}
      rowHref={href}
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
              {d.text !== "—" ? <><span className={toneClass(d.tone)}>{d.text}</span> · </> : null}суудал {describeSaasSeats(row).text} · {row.memberCount} гишүүн
            </>
          ),
        };
      }}
    />
  );
}
