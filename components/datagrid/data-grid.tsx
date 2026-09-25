"use client";

// Console-ийн ЦОРЫН ГАНЦ хүснэгт — Entry core-ийн хүснэгтийн стандарттай ИЖИЛ
// (AG Grid Community v35, --ea-* theme, давхар даралт/Enter → дэлгэрэнгүй).
// `<table>`-ээр шинэ жагсаалт бичихийг ХОРИГЛОНО.
//
// Утсан дээр (<640px) хүснэгтийн ОРОНД карт: 390px-д 10 баганаас 2 л харагдаж,
// төлөв/хугацаа дэлгэцээс гадуур үлддэг байв. Карт нь SSR-д CSS-ээр
// (`sm:hidden`) гардаг тул hydration-ы анивчилтгүй; AG Grid зөвхөн десктопод
// mount болно.

import type { ColDef } from "ag-grid-community";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import type { AgTableProps } from "./ag-table";

const AgTable = dynamic(() => import("./ag-table"), { ssr: false }) as <T>(props: AgTableProps<T>) => ReactNode;

const MOBILE_QUERY = "(max-width: 639px)";
const HEADER_HEIGHT = 36;
/** Үүнээс олон мөртэй бол хүснэгт тогтмол өндөртэй, дотроо гүйлгэнэ. */
const AUTO_HEIGHT_MAX_ROWS = 25;
const SCROLL_HEIGHT = 620;
const CARD_PAGE = 20;

function subscribeMobile(listener: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Утасны өргөн эсэх — SSR/анхны render-т false. */
function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

export type MobileCard = {
  /** Нэр — картын гарчиг */
  title: string;
  /** Гарчгийн доорх нэг мөр (repo, ТТД, и-мэйл …) */
  subtitle?: string | null;
  /** Баруун дээд булан — огноо, дүн г.м. */
  corner?: ReactNode;
  /** Төлөв, багц зэрэг badge-ууд */
  badges?: ReactNode;
  /** Доод мөр — нэмэлт тайлбар */
  meta?: ReactNode;
  /** Үйлдлийн товч (Устгах, Таслах …) — линкээс ГАДУУР (давхар даралт болохгүй) */
  actions?: ReactNode;
};

export type DataGridProps<T> = {
  rows: T[];
  columns: ColDef<T>[];
  getRowId: (row: T) => string;
  /** Мөрийн дэлгэрэнгүй хуудас (давхар даралт, Enter, картын даралт) */
  rowHref?: (row: T) => string | null;
  /** Утасны карт; өгөөгүй бол утсан дээр ч хүснэгт (гүйлгэх) */
  card?: (row: T) => MobileCard;
  ariaLabel: string;
  rowHeight?: number;
  empty?: ReactNode;
};

export function DataGrid<T>({ rows, columns, getRowId, rowHref, card, ariaLabel, rowHeight = 44, empty }: DataGridProps<T>) {
  const mobile = useIsMobileViewport();
  if (rows.length === 0 && empty) return <>{empty}</>;

  const height = rows.length > AUTO_HEIGHT_MAX_ROWS ? SCROLL_HEIGHT : "auto";
  const placeholderHeight = height === "auto" ? HEADER_HEIGHT + rows.length * rowHeight + 2 : height;
  const showGrid = !card || !mobile;

  return (
    <>
      {card ? <CardList rows={rows} card={card} getRowId={getRowId} rowHref={rowHref} ariaLabel={ariaLabel} /> : null}
      <div className={card ? "hidden sm:block" : undefined} style={{ minHeight: placeholderHeight }}>
        {showGrid ? (
          <AgTable rows={rows} columns={columns} getRowId={getRowId} rowHref={rowHref} rowHeight={rowHeight} height={height} ariaLabel={ariaLabel} />
        ) : null}
      </div>
    </>
  );
}

function CardList<T>({
  rows,
  card,
  getRowId,
  rowHref,
  ariaLabel,
}: {
  rows: T[];
  card: (row: T) => MobileCard;
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string | null;
  ariaLabel: string;
}) {
  const [limit, setLimit] = useState(CARD_PAGE);
  return (
    <div className="sm:hidden">
      <ul aria-label={ariaLabel} className="flex flex-col gap-2">
        {rows.slice(0, limit).map((row) => {
          const c = card(row);
          const href = rowHref?.(row) ?? null;
          const body = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-medium text-text-1">{c.title}</span>
                  {c.subtitle ? <span className="mono block truncate text-text-3">{c.subtitle}</span> : null}
                </span>
                {c.corner ? <span className="shrink-0 text-right text-xs text-text-3">{c.corner}</span> : null}
              </span>
              {c.badges ? <span className="flex flex-wrap items-center gap-1.5">{c.badges}</span> : null}
              {c.meta ? <span className="text-xs text-text-3">{c.meta}</span> : null}
            </>
          );
          const cls = "flex min-h-11 w-full flex-col gap-2 px-3.5 py-3 text-left";
          return (
            <li key={getRowId(row)} className="mobile-card" data-link={href ? true : undefined}>
              {href ? (
                <Link href={href} className={cls}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
              {c.actions ? <div className="flex flex-wrap gap-2 border-t border-border px-3.5 py-2.5">{c.actions}</div> : null}
            </li>
          );
        })}
      </ul>
      {rows.length > limit ? (
        <button type="button" className="btn mt-3 h-11 w-full" onClick={() => setLimit((current) => current + CARD_PAGE)}>
          Цааш харах ({rows.length - limit})
        </button>
      ) : null}
    </div>
  );
}
