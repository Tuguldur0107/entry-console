"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons } from "./icons";

const ITEMS = [
  { href: "/", label: "Самбар", icon: Icons.dashboard, exact: true },
  { href: "/customers", label: "Харилцагчид", icon: Icons.users },
  { href: "/customers/new", label: "Харилцагч нэмэх", icon: Icons.plus, exact: true },
  { href: "/settings", label: "Тохиргоо, шалгалт", icon: Icons.settings },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {ITEMS.map((item) => {
        const active = item.exact ? path === item.href : path === item.href || (path.startsWith(item.href + "/") && !path.startsWith("/customers/new"));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="nav-link" data-active={active}>
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
