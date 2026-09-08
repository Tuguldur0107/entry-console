import type { Metadata } from "next";
import Link from "next/link";

import { hasSession } from "@/lib/auth";
import { logout } from "@/lib/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entry Console",
  description: "Entry Accounting — харилцагчийн repo-уудын удирдлага",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await hasSession();
  return (
    <html lang="mn">
      <body className="min-h-screen">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Entry <span className="text-text-3">Console</span>
            </Link>
            {authed && (
              <nav className="flex items-center gap-4 text-sm text-text-2">
                <Link href="/" className="hover:text-text-1">Самбар</Link>
                <Link href="/customers/new" className="hover:text-text-1">Харилцагч нэмэх</Link>
              </nav>
            )}
            {authed && (
              <form action={logout} className="ml-auto">
                <button className="text-sm text-text-3 hover:text-text-1" type="submit">Гарах</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
