"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons } from "./icons";

type Item = { href: string; label: string; icon: (typeof Icons)[keyof typeof Icons]; exact?: boolean };

// Бүлэглэсэн цэс — dedicated харилцагч, SaaS, харилцаа, хяналт тусдаа.
const GROUPS: { title: string | null; items: Item[] }[] = [
  { title: null, items: [{ href: "/", label: "Самбар", icon: Icons.dashboard, exact: true }] },
  { title: "Тусдаа сервис", items: [{ href: "/customers", label: "Харилцагчид", icon: Icons.users }] },
  {
    title: "SaaS",
    items: [
      { href: "/subscriptions", label: "Байгууллагууд", icon: Icons.activity },
      { href: "/funnel", label: "Туршилтын funnel", icon: Icons.funnel },
      { href: "/ai-accountant", label: "AI нягтлан", icon: Icons.ai },
    ],
  },
  {
    title: "Харилцаа",
    items: [
      { href: "/chat", label: "Landing чат", icon: Icons.chat },
      { href: "/emails", label: "И-мэйл", icon: Icons.mail },
    ],
  },
  {
    title: "Хяналт",
    items: [
      { href: "/ai-tools", label: "AI tool-ийн хэрэглээ", icon: Icons.tools },
      { href: "/ontology", label: "Ontology тайлан", icon: Icons.check },
      { href: "/beacons", label: "Илрүүлэлт", icon: Icons.alert },
      { href: "/settings", label: "Тохиргоо, шалгалт", icon: Icons.settings },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="space-y-4" aria-label="Үндсэн цэс">
      {GROUPS.map((group, index) => (
        <div key={group.title ?? index} className="space-y-0.5">
          {group.title ? <div className="nav-group">{group.title}</div> : null}
          {group.items.map((item) => {
            const active = item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="nav-link" data-active={active} aria-current={active ? "page" : undefined}>
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
