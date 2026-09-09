import type { Metadata } from "next";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { Nav } from "@/components/nav";
import { THEME_INIT_SCRIPT, ThemeToggle } from "@/components/theme-toggle";
import { hasSession } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { config } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Entry Console", template: "%s · Entry Console" },
  description: "Entry Accounting — харилцагчийн удирдлага",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await hasSession();
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        {authed ? (
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex">
              <Link href="/" className="mb-5 flex items-center gap-2 px-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">E</span>
                <span className="text-sm font-semibold tracking-tight">
                  Entry <span className="text-text-3">Console</span>
                </span>
              </Link>
              <Nav />
              <div className="mt-auto space-y-2 px-2 pt-4 text-xs text-text-3">
                <div className="divider mb-3" />
                <div>Repo эзэн: <span className="mono text-text-2">{config.owner}</span></div>
                <div>Core: <span className="mono text-text-2">{config.coreRepo.split("/")[1]}</span></div>
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur md:px-6">
                <Link href="/" className="text-sm font-semibold md:hidden">Entry Console</Link>
                <div className="md:hidden">
                  <MobileNav />
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <ThemeToggle />
                  <form action={logout}>
                    <button className="btn btn-ghost btn-sm" type="submit" title="Гарах">
                      <Icons.logout className="h-4 w-4" />
                      <span className="hidden sm:inline">Гарах</span>
                    </button>
                  </form>
                </div>
              </header>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
            </div>
          </div>
        ) : (
          <div className="min-h-screen">
            <header className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-semibold">Entry <span className="text-text-3">Console</span></span>
              <ThemeToggle />
            </header>
            <main className="mx-auto max-w-5xl px-4">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}

function MobileNav() {
  return (
    <div className="flex gap-1 text-xs">
      <Link href="/" className="btn btn-ghost btn-sm">Самбар</Link>
      <Link href="/customers" className="btn btn-ghost btn-sm">Харилцагчид</Link>
      <Link href="/settings" className="btn btn-ghost btn-sm">Тохиргоо</Link>
    </div>
  );
}
