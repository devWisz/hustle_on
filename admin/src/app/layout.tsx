import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { AdminHealth } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sardhana Admin", template: "%s — Sardhana Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/users", label: "Accounts" },
  { href: "/videos", label: "Sessions" },
  { href: "/jobs", label: "Roles" },
  { href: "/reports", label: "Reports" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: health, status } = await apiServer<AdminHealth>("/v1/admin/health");
  const dbOk = health?.database === "connected";
  const dbLabel = !health
    ? status === 401
      ? "Sign in required"
      : status === 403
        ? "No access"
        : "API not responding"
    : dbOk
      ? `Connected · ${health.latencyMs}ms`
      : "Unreachable";

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="flex min-h-dvh">
          <aside className="hidden w-60 shrink-0 border-r border-border bg-surface sm:flex sm:flex-col">
            <div className="flex h-14 items-center gap-2 border-b border-border px-5">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">Sardhana Admin</span>
            </div>
            <nav aria-label="Admin" className="flex-1 p-3">
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
            <div className="border-t border-border p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
                Database
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-[13px]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${dbOk ? "bg-accent" : "bg-danger"}`}
                  aria-hidden
                />
                {dbLabel}
              </p>
              {health ? (
                <p className="mt-1 text-[12px] text-fg-subtle">
                  {health.env} · {health.cluster}
                </p>
              ) : null}
              <p className="mt-3 text-[12px] leading-relaxed text-fg-subtle">
                Every action is written to the audit log with your account attached.
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-14 items-center justify-between gap-3 overflow-x-auto border-b border-border px-5 sm:hidden">
              <span className="shrink-0 text-sm font-semibold">Admin</span>
              <nav className="flex gap-3">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="shrink-0 text-[13px] text-fg-muted">
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
