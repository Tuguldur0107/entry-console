// Console-ийн icon — Entry-ийн ICON KIT-ийг шууд хэрэглэнэ
// (`components/ui/icon.tsx` + `icon-registry.ts`, lucide суурьтай).
// Энд зөвхөн Console-ийн нэрсийг Entry-ийн `IconName` рүү буулгана — шинэ
// SVG зурахыг ХОРИГЛОНО, Entry-д байгаа нэрийг л ашиглана.
//
// Үл хамаарах: `github` нь брэндийн лого тул Entry-ийн бүтээгдэхүүний kit-д
// байхгүй — ганц энэ глиф энд үлдэнэ.

import type { SVGProps } from "react";

import { Icon, type IconName } from "./ui/icon";

// `name` нь Icon-ийнх тул дуудагчийн SVG `name` атрибут давхцахгүй.
type P = Omit<SVGProps<SVGSVGElement>, "name" | "color" | "height" | "width">;

const mapped = (name: IconName) =>
  function MappedIcon(props: P) {
    return <Icon name={name} size="md" {...props} />;
  };

export const Icons = {
  dashboard: mapped("dashboard"),
  users: mapped("company"),
  plus: mapped("add"),
  settings: mapped("settings"),
  sun: mapped("lightMode"),
  moon: mapped("darkMode"),
  external: mapped("openExternal"),
  rocket: mapped("send"),
  refresh: mapped("refresh"),
  search: mapped("search"),
  alert: mapped("warning"),
  check: mapped("approve"),
  logout: mapped("power"),
  activity: mapped("movement"),
  ai: mapped("ai"),
  billing: mapped("cash"),
  download: mapped("download"),
  arrowLeft: mapped("arrowLeft"),
  menu: mapped("list"),
  close: mapped("close"),
  /** Брэндийн лого — Entry-ийн kit-д байхгүй цорын ганц глиф. */
  github: (p: P) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      style={{ width: "var(--ea-icon-size-md)", height: "var(--ea-icon-size-md)" }}
      aria-hidden
      {...p}
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  ),
};
