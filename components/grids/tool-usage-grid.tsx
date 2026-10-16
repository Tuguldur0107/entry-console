"use client";

import type { ColDef } from "ag-grid-community";

import { DataGrid } from "@/components/datagrid/data-grid";
import { errorTone, fmtRate, writeAcceptance, type ToolUsageSummary } from "@/lib/saas-insights";

const num = (value: number) => value.toLocaleString("en-US");
const toneClass = (tone: "danger" | "warning" | null) => (tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "");
const topCodes = (row: ToolUsageSummary) =>
  row.errorCodes.slice(0, 3).map((code) => `${code.code} ×${code.calls}`).join(", ") || "—";

const COLUMNS: ColDef<ToolUsageSummary>[] = [
  { headerName: "Tool", field: "toolName", pinned: "left", minWidth: 230, flex: 2, cellClass: "mono" },
  { headerName: "Дуудлага", field: "calls", minWidth: 110, type: "rightAligned", sort: "desc", valueFormatter: ({ value }) => num(value as number) },
  {
    headerName: "Алдаа",
    field: "errorRate",
    minWidth: 120,
    type: "rightAligned",
    tooltipValueGetter: ({ data }) => (data ? `${num(data.errors)} алдаа` : null),
    cellRenderer: ({ data }: { data?: ToolUsageSummary }) =>
      data ? <span className={toneClass(errorTone(data.errorRate))}>{data.errors ? fmtRate(data.errorRate) : "—"}</span> : null,
  },
  { headerName: "Алдааны код", colId: "codes", minWidth: 220, flex: 2, valueGetter: ({ data }) => (data ? topCodes(data) : ""), cellClass: "mono text-text-2" },
  { headerName: "Байгууллага", field: "organizations", minWidth: 120, type: "rightAligned" },
  {
    headerName: "Хугацаа",
    colId: "latency",
    minWidth: 140,
    type: "rightAligned",
    valueGetter: ({ data }) => data?.avgLatencyMs ?? 0,
    tooltipValueGetter: ({ data }) => (data ? `Дээд ${num(data.maxLatencyMs)} мс` : null),
    valueFormatter: ({ value, data }) => (data ? `${num(value as number)} мс · ↑${num(data.maxLatencyMs)}` : ""),
  },
  {
    headerName: "Санал хүлээн авсан",
    colId: "writes",
    minWidth: 170,
    type: "rightAligned",
    valueGetter: ({ data }) => writeAcceptance(data?.writes ?? null) ?? -1,
    tooltipValueGetter: ({ data }) =>
      data?.writes
        ? `Санал ${data.writes.suggestions}: хүлээн авсан ${data.writes.accepted}, засварласан ${data.writes.modified}, устгасан ${data.writes.rejected}, хөндөөгүй ${data.writes.noAction} · батлагдсан ${data.writes.posted}, буцаагдсан ${data.writes.reversed}`
        : "Бичилт үүсгэдэггүй tool",
    valueFormatter: ({ data }) => (data?.writes ? `${fmtRate(writeAcceptance(data.writes))} · ${data.writes.suggestions}` : "—"),
  },
];

export function ToolUsageGrid({ rows }: { rows: ToolUsageSummary[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={COLUMNS}
      getRowId={(row) => row.toolName}
      ariaLabel="AI tool-ийн хэрэглээ"
      card={(row) => ({
        title: row.toolName,
        corner: `${num(row.calls)} дуудлага`,
        badges: row.errors ? <span className={`badge ${errorTone(row.errorRate) === "danger" ? "badge-danger" : "badge-warning"}`}>{fmtRate(row.errorRate)} алдаа</span> : null,
        meta: row.errors ? topCodes(row) : `${row.organizations} байгууллага`,
      })}
    />
  );
}
