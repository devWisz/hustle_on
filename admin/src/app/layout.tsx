import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sardhana Admin", template: "%s — Sardhana Admin" },
  // Nothing in this console should ever reach a search index.
  robots: { index: false, follow: false, nocache: true },
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/reports", label: "Reports" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="flex min-h-dvh">
          <aside className="hidden w-56 shrink-0 border-r border-border bg-surface sm:block">
            <div className="flex h-14 items-center gap-2 border-b border-border px-5">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">Sardhana Admin</span>
            </div>
            <nav aria-label="Admin" className="p-3">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-[var(--radius-control)] px-3 py-2 text-[13px] text-fg-muted
                             transition-colors hover:bg-surface-raised hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-5 pt-4 text-[12px] leading-relaxed text-fg-subtle">
              Every action taken here is written to the audit log with your account attached.
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-14 items-center justify-between border-b border-border px-5 sm:hidden">
              <span className="text-sm font-semibold">Sardhana Admin</span>
              <nav className="flex gap-3">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="text-[13px] text-fg-muted">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="p-5 sm:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
