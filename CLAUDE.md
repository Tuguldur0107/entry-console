@AGENTS.md

# Entry Console — UI дүрэм (ХАТУУ, product owner 2026-10-17)

- **Бэлэн component / ui-kit / icon-kit ЗААВАЛ.** Шинэ загвар, өөр хэв маяг ЗОХИОХГҮЙ; ижил UI-г хоёр
  газар хуулж бичихгүй — нэг component болгоно. Kit-д байхгүй бол kit-д НЭМЖ байж ашиглана.
  - Хуудас: `PageHeader`, `Section`, `Kpi`, `EmptyState`, `FilterChips`, `SearchForm` (`components/ui.tsx`)
  - Хүснэгт: `DataGrid` (`components/datagrid`, `components/grids/*`) — HTML `<table>` ХОРИОТОЙ
  - Форм: `Field`, `Notice` (`components/ui/notice.tsx`), `.btn` / `.input` / `.select` класс
  - Баталгаажуулалт: `askConfirm` (`components/ui/confirm-dialog.tsx`), нэр/код бичүүлэх нь
    `TypedConfirmZone` (`components/ui/typed-confirm.tsx`) — `window.confirm`, гар modal ХОРИОТОЙ
  - Дүрс: `Icon` / `Icons` — lucide-react шууд импорт, гар `<svg>` ХОРИОТОЙ
  - Огноо: `fmtDate` / `fmtAgo` (`components/ui.tsx`) — component дотор `Intl` / `toLocale*Date*` бичихгүй
- **Өнгө/радиус/сүүдэр ЗӨВХӨН `--ea-*` токен** — hex/rgba бичихгүй.
- **ui-kit-ийг Console-д гараар засахгүй** — `ui-kit/tokens.css`, `components/ui/icon-*` нь core
  (entry-accounting)-ийн ХУУЛБАР: core-д засаад `npm run ui-kit:sync` (`ui-kit:check` зөрүүг шалгана).
- `tests/ui-kit-usage.test.ts` эдгээрийг сахиулна (хуучин өр KNOWN-д, ЗӨВХӨН багасна).
