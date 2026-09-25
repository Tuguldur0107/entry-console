// AG Grid v35 Theming API — Entry core-ийн `lib/grid/theme.ts`-тэй ИЖИЛ
// параметр. Өнгө бүгд --ea-* токеноос (ui-kit/tokens.css) тул light/dark
// хоёуланд нэг theme ажиллана; энд hex бичихийг ХОРИГЛОНО.

import { themeQuartz } from "ag-grid-community";

export const eaGridTheme = themeQuartz.withParams({
  backgroundColor: "var(--ea-surface)",
  foregroundColor: "var(--ea-text-1)",
  borderColor: "var(--ea-border)",
  chromeBackgroundColor: "var(--ea-bg-2)",
  headerBackgroundColor: "var(--ea-bg-2)",
  headerTextColor: "var(--ea-text-2)",
  headerFontWeight: 600,
  oddRowBackgroundColor: "var(--ea-surface)",
  rowHoverColor: "var(--ea-hover-subtle)",
  selectedRowBackgroundColor: "var(--ea-selected-bg)",
  accentColor: "var(--ea-interactive)",
  fontFamily: "inherit",
  wrapperBorderRadius: 8,
  borderRadius: 4,
  rowHeight: 44,
  headerHeight: 36,
  fontSize: 13,
  cellHorizontalPadding: 12,
});
