"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";

import { DataGrid } from "@/components/datagrid/data-grid";
import { fmtAgo } from "@/components/ui";
import type { BeaconVerdict } from "@/lib/db/schema";

export type BeaconGridRow = {
  id: string;
  verdict: BeaconVerdict;
  appUrl: string | null;
  customerSlug: string | null;
  customerName: string | null;
  /** Харилцагчгүй үед лиценз / тэмдгийн slug */
  who: string;
  origin: string | null;
  ip: string | null;
  version: string | null;
  nodeEnv: string | null;
  lastSeenAt: string;
  hitCount: number;
};

const VERDICT: Record<BeaconVerdict, { label: string; cls: string }> = {
  healthy: { label: "Хэвийн", cls: "badge-success" },
  mismatch: { label: "Домэйн зөрүү", cls: "badge-warning" },
  leaked: { label: "Код алдагдсан", cls: "badge-danger" },
  unknown: { label: "Бүртгэлгүй", cls: "badge-danger" },
};

function Verdict({ v }: { v: BeaconVerdict }) {
  return <span className={`badge ${VERDICT[v].cls}`}>{VERDICT[v].label}</span>;
}

const verdictCol: ColDef<BeaconGridRow> = {
  headerName: "Төлөв",
  field: "verdict",
  pinned: "left",
  minWidth: 150,
  maxWidth: 170,
  cellRenderer: ({ data }: { data?: BeaconGridRow }) => (data ? <Verdict v={data.verdict} /> : null),
};
const whoCol: ColDef<BeaconGridRow> = {
  headerName: "Харилцагч",
  field: "who",
  minWidth: 170,
  cellRenderer: ({ data }: { data?: BeaconGridRow }) =>
    !data ? null : data.customerSlug ? (
      <Link href={`/customers/${data.customerSlug}`} className="hover:underline">{data.who}</Link>
    ) : (
      <span className="text-text-2">{data.who}</span>
    ),
};
const urlCol: ColDef<BeaconGridRow> = { headerName: "Домэйн", field: "appUrl", minWidth: 240, flex: 2, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" };
const seenCol: ColDef<BeaconGridRow> = {
  headerName: "Сүүлд",
  field: "lastSeenAt",
  minWidth: 120,
  sort: "desc",
  valueFormatter: ({ value, data }) => (data ? `${fmtAgo(value)}${data.hitCount > 1 ? ` · ${data.hitCount}×` : ""}` : ""),
};

const SUSPICIOUS: ColDef<BeaconGridRow>[] = [
  verdictCol,
  whoCol,
  urlCol,
  { headerName: "Гарал үүсэл", field: "origin", minWidth: 200, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "IP", field: "ip", minWidth: 130, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  seenCol,
];
const ALL: ColDef<BeaconGridRow>[] = [
  verdictCol,
  urlCol,
  whoCol,
  { headerName: "Хувилбар", field: "version", minWidth: 110, cellClass: "mono", valueFormatter: ({ value }) => value ?? "—" },
  { headerName: "Орчин", field: "nodeEnv", minWidth: 110, valueFormatter: ({ value }) => value ?? "—" },
  seenCol,
];

export function BeaconsGrid({ rows, suspicious = false }: { rows: BeaconGridRow[]; suspicious?: boolean }) {
  return (
    <DataGrid
      rows={rows}
      columns={suspicious ? SUSPICIOUS : ALL}
      getRowId={(row) => row.id}
      rowHref={(row) => (row.customerSlug ? `/customers/${row.customerSlug}` : null)}
      ariaLabel={suspicious ? "Сэрэмжлүүлэг шаардсан instance" : "Бүх дохио"}
      card={(row) => ({
        title: row.appUrl ?? "домэйн тодорхойгүй",
        subtitle: row.who,
        corner: fmtAgo(row.lastSeenAt),
        badges: <Verdict v={row.verdict} />,
        meta: [row.version && `v${row.version}`, row.nodeEnv, suspicious ? row.ip : null, suspicious ? row.origin : null].filter(Boolean).join(" · "),
      })}
    />
  );
}
