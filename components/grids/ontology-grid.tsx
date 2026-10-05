"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtAgo, fmtDate } from "@/components/ui";
import type { TargetState, TargetStatus } from "@/lib/ontology-report";

export type OntologyStatusRow = TargetStatus & {
  key: string;
  name: string;
  url: string;
  slug: string | null;
  version: string | null;
};

export type OntologyHistoryRow = {
  id: string;
  createdAt: string;
  trigger: "schedule" | "manual";
  last7d: number;
  attention: number;
  deployments: number;
  detail: string;
  notified: boolean;
};

const STATE: Record<TargetState, { label: string; cls: string }> = {
  ok: { label: "Цэвэр", cls: "badge-success" },
  violations: { label: "Зөрчилтэй", cls: "badge-warning" },
  typo: { label: "Env алдаатай", cls: "badge-warning" },
  down: { label: "Хүрэхгүй", cls: "badge-danger" },
  nodata: { label: "Мэдээлэлгүй", cls: "" },
};

function State({ s }: { s: TargetState }) {
  return <span className={`badge ${STATE[s].cls}`}>{STATE[s].label}</span>;
}

const STATUS_COLS: ColDef<OntologyStatusRow>[] = [
  {
    headerName: "Deployment",
    field: "name",
    pinned: "left",
    minWidth: 180,
    cellRenderer: ({ data }: { data?: OntologyStatusRow }) =>
      !data ? null : data.slug ? (
        <Link href={`/customers/${data.slug}`} className="hover:underline">{data.name}</Link>
      ) : (
        <span>{data.name}</span>
      ),
  },
  { headerName: "Төлөв", field: "state", minWidth: 130, maxWidth: 150, cellRenderer: ({ data }: { data?: OntologyStatusRow }) => (data ? <State s={data.state} /> : null) },
  { headerName: "7 хоногт", field: "last7d", minWidth: 100, type: "rightAligned", valueFormatter: ({ value }) => (value === null || value === undefined ? "—" : String(value)) },
  { headerName: "Нийт", field: "total", minWidth: 90, type: "rightAligned", valueFormatter: ({ value }) => (value === null || value === undefined ? "—" : String(value)) },
  { headerName: "Объектоор", field: "top", minWidth: 200, flex: 1, cellClass: "mono", valueFormatter: ({ value }) => value || "—" },
  { headerName: "Горим", field: "mode", minWidth: 140, cellClass: "mono" },
  { headerName: "Хувилбар", field: "version", minWidth: 100, cellClass: "mono", valueFormatter: ({ value }) => (value ? `v${value}` : "—") },
  { headerName: "Сүүлийн зөрчил", field: "lastAt", minWidth: 130, valueFormatter: ({ value }) => (value ? fmtAgo(value) : "—") },
  { headerName: "Тайлбар", field: "note", minWidth: 220, flex: 1, valueFormatter: ({ value }) => value ?? "" },
];

export function OntologyStatusGrid({ rows }: { rows: OntologyStatusRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={STATUS_COLS}
      getRowId={(row) => row.key}
      rowHref={(row) => (row.slug ? `/customers/${row.slug}` : null)}
      ariaLabel="Deployment бүрийн ontology төлөв"
      card={(row) => ({
        title: row.name,
        subtitle: row.url,
        corner: row.last7d === null ? "—" : `${row.last7d} зөрчил`,
        badges: <State s={row.state} />,
        meta: [row.version && `v${row.version}`, row.mode, row.top, row.note].filter(Boolean).join(" · "),
      })}
    />
  );
}

const HISTORY_COLS: ColDef<OntologyHistoryRow>[] = [
  { headerName: "Огноо", field: "createdAt", pinned: "left", minWidth: 150, sort: "desc", valueFormatter: ({ value }) => fmtDate(value) },
  { headerName: "Төрөл", field: "trigger", minWidth: 110, valueFormatter: ({ value }) => (value === "schedule" ? "Хуваарьт" : "Гараар") },
  { headerName: "7 хоногт", field: "last7d", minWidth: 100, type: "rightAligned" },
  { headerName: "Анхаарах", field: "attention", minWidth: 100, type: "rightAligned" },
  { headerName: "Deployment", field: "deployments", minWidth: 110, type: "rightAligned" },
  { headerName: "Дэлгэрэнгүй", field: "detail", minWidth: 260, flex: 1, cellClass: "mono" },
  { headerName: "Мэдэгдэл", field: "notified", minWidth: 110, cellDataType: false, valueFormatter: ({ value }) => (value ? "илгээсэн" : "—") },
];

export function OntologyHistoryGrid({ rows }: { rows: OntologyHistoryRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={HISTORY_COLS}
      getRowId={(row) => row.id}
      ariaLabel="Ontology тайлангийн түүх"
      card={(row) => ({
        title: fmtDate(row.createdAt),
        subtitle: row.detail,
        corner: `${row.last7d} зөрчил`,
        meta: [row.trigger === "schedule" ? "Хуваарьт" : "Гараар", row.attention ? `анхаарах ${row.attention}` : null, row.notified ? "илгээсэн" : null].filter(Boolean).join(" · "),
      })}
    />
  );
}
