"use client";

// AG Grid-ийн жинхэнэ render — ЗӨВХӨН `data-grid.tsx`-ээс dynamic(ssr:false)-аар
// ачаална: AG Grid module init үед `document` хэрэгтэй (core-ийн DataGridDynamic
// ИЖИЛ шалтгаан).

import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type RowSelectionOptions,
  type SelectionChangedEvent,
} from "ag-grid-community";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  selection?: GridSelection<T>;
};

/** Мөр сонгох (checkbox) — сонголтын эзэн нь дуудагч (ID-ийн Set). */
export type GridSelection<T> = {
  selected: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
  /** false = сонгох боломжгүй мөр (жишээ нь татгалзсан хүлээн авагч). */
  isSelectable?: (row: T) => boolean;
};

const DEFAULT_COL: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
  minWidth: 90,
  flex: 1,
};

export default function AgTable<T>({ rows, columns, getRowId, rowHref, rowHeight, height, ariaLabel, selection }: AgTableProps<T>) {
  const router = useRouter();
  const api = useRef<GridApi<T> | null>(null);
  const isSelectable = selection?.isSelectable;
  const hasSelection = Boolean(selection);
  const rowSelection = useMemo<RowSelectionOptions<T> | undefined>(
    () =>
      hasSelection
        ? {
            mode: "multiRow",
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
            isRowSelectable: (node) => (node.data && isSelectable ? isSelectable(node.data) : true),
          }
        : undefined,
    // selection-ийн объект render бүрд шинэ — зөвхөн байгаа эсэх ба шүүлтүүр нь чухал
    [hasSelection, isSelectable]
  );
  // Гаднаас өөрчлөгдсөн сонголтыг (жишээ нь «Шүүлтүүрийг бүгдийг сонгох») grid-д тусгана.
  const selected = selection?.selected;
  useEffect(() => {
    if (!api.current || !selected) return;
    api.current.forEachNode((node) => {
      const want = node.id ? selected.has(node.id) : false;
      if (node.isSelected() !== want && node.selectable) node.setSelected(want, false, "api");
    });
  }, [selected, rows]);
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<T>) => {
      if (!selection) return;
      const ids = new Set(event.api.getSelectedNodes().map((node) => node.id!).filter(Boolean));
      const same = ids.size === selection.selected.size && [...ids].every((id) => selection.selected.has(id));
      if (!same) selection.onChange(ids);
    },
    [selection]
  );
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
        rowSelection={rowSelection}
        onSelectionChanged={selection ? onSelectionChanged : undefined}
        onGridReady={(event) => {
          api.current = event.api;
          if (selected)
            event.api.forEachNode((node) => {
              if (node.id && selected.has(node.id) && node.selectable) node.setSelected(true, false, "api");
            });
        }}
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
