"use client";

// AG Grid-ийн жинхэнэ render — ЗӨВХӨН `data-grid.tsx`-ээс dynamic(ssr:false)-аар
// ачаална: AG Grid module init үед `document` хэрэгтэй (core-ийн DataGridDynamic
// ИЖИЛ шалтгаан).

import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GetRowIdParams } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { eaGridTheme } from "./theme";

ModuleRegistry.registerModules([AllCommunityModule]);

export type AgTableProps<T> = {
  rows: T[];
  columns: ColDef<T>[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string | null;
  rowHeight: number;
  height: number | "auto";
  ariaLabel: string;
};

const DEFAULT_COL: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
  minWidth: 90,
  flex: 1,
};

export default function AgTable<T>({ rows, columns, getRowId, rowHref, rowHeight, height, ariaLabel }: AgTableProps<T>) {
  const router = useRouter();
  const rowId = useCallback((params: GetRowIdParams<T>) => getRowId(params.data), [getRowId]);
  const open = useCallback(
    (row: T | undefined) => {
      const href = row && rowHref ? rowHref(row) : null;
      if (href) router.push(href);
    },
    [router, rowHref]
  );
  const style = useMemo(() => (height === "auto" ? { width: "100%" } : { width: "100%", height }), [height]);

  return (
    <div className="ea-data-grid" style={style} role="region" aria-label={ariaLabel}>
      <AgGridReact<T>
        theme={eaGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={DEFAULT_COL}
        getRowId={rowId}
        rowHeight={rowHeight}
        domLayout={height === "auto" ? "autoHeight" : "normal"}
        suppressCellFocus={false}
        // Entry-ийн гэрээ: давхар даралт / Enter → дэлгэрэнгүй (нэрийн линк
        // нэг даралтаар ч нээнэ — олж харахад амар).
        onRowDoubleClicked={(event) => open(event.data)}
        onCellKeyDown={(event) => {
          if ((event.event as KeyboardEvent | undefined)?.key === "Enter") open(event.data);
        }}
        rowClass={rowHref ? "ea-row-link" : undefined}
        overlayNoRowsTemplate="<span>Мөр алга</span>"
      />
    </div>
  );
}
