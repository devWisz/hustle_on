"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, ButtonLink } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { SearchBar } from "./search-bar";
import { CloseIcon, MenuIcon } from "./icons";

/**
 * The site header (client component for mobile menu interactivity).
 *
 * It receives the user session from the server wrapper below, so the
 * signed-in state is correct on first paint.
 */

interface HeaderUser {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  role: "member" | "admin";
}

export function SiteHeaderClient({ user }: { user?: HeaderUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-5 sm:px-6">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-5 text-sm sm:flex">
          <NavLink href="/">Timelapses</NavLink>
          {user ? <NavLink href="/dashboard">Dashboard</NavLink> : null}
          {user?.role === "admin" ? <NavLink href="/admin">Review</NavLink> : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <ThemeToggle />
          {user ? (
            <>
              <ButtonLink href="/upload" size="sm">
                Upload
              </ButtonLink>
              <Link
                href={`/creator/${user.handle}`}
                className="rounded-full transition-all duration-200 hover:opacity-80 hover:ring-2 hover:ring-accent/20"
                aria-label={`Your profile, ${user.displayName}`}
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size={30} />
              </Link>
            </>
          ) : (
            <ButtonLink href="/login" variant="secondary" size="sm">
              Sign in
            </ButtonLink>
          )}

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)]
                       text-fg-muted sm:hidden transition-colors hover:bg-surface-raised hover:text-fg"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 drawer-overlay sm:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <nav
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-bg p-6 shadow-[var(--shadow-raised)] sm:hidden"
            style={{ animation: "slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <div className="flex items-center justify-between mb-8">
              <Wordmark />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-[var(--radius-control)] p-1.5 text-fg-subtle hover:bg-surface-raised hover:text-fg"
                aria-label="Close menu"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <MobileNavLink href="/" onClick={() => setMobileOpen(false)}>
                Timelapses
              </MobileNavLink>
              {user ? (
                <MobileNavLink href="/dashboard" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </MobileNavLink>
              ) : null}
              {user?.role === "admin" ? (
                <MobileNavLink href="/admin" onClick={() => setMobileOpen(false)}>
                  Review
                </MobileNavLink>
              ) : null}
              <MobileNavLink href="/about" onClick={() => setMobileOpen(false)}>
                About
              </MobileNavLink>

              <div className="pt-4 border-t border-border mt-4">
                {user ? (
                  <>
                    <MobileNavLink href="/upload" onClick={() => setMobileOpen(false)}>
                      Upload a timelapse
                    </MobileNavLink>
                    <MobileNavLink href="/settings" onClick={() => setMobileOpen(false)}>
                      Settings
                    </MobileNavLink>
                    <MobileNavLink href={`/creator/${user.handle}`} onClick={() => setMobileOpen(false)}>
                      Your profile
                    </MobileNavLink>
                  </>
                ) : (
                  <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </MobileNavLink>
                )}
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[12px] text-fg-subtle">
                Press <kbd className="rounded border border-border bg-surface-raised px-1 py-0.5 font-mono text-[10px]">?</kbd> for shortcuts
              </p>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

/**
 * The server component that resolves the session and passes it to the client.
 *
 * It renders on the server so the signed-in state is correct on first paint —
 * a header that flashes "Sign in" and then swaps to an avatar is the single
 * most noticeable way an app looks unfinished.
 */
export async function SiteHeader() {
  const { apiServer } = await import("@/lib/api");
  type SessionResponse = { authenticated: boolean; user?: HeaderUser };
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  const user = session?.authenticated ? session.user : undefined;
  return <SiteHeaderClient user={user} />;
}

/** Shown while the server component above is still resolving the session. */
export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5 sm:px-6">
        <Wordmark />
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="text-[15px] font-semibold tracking-tight transition-colors hover:text-accent">
      Sardhana
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative text-fg-muted transition-colors hover:text-fg
                 after:absolute after:bottom-[-18px] after:left-0 after:right-0
                 after:h-[2px] after:bg-accent after:scale-x-0 after:transition-transform
                 after:origin-left hover:after:scale-x-100"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center rounded-[var(--radius-control)] px-3 py-2.5 text-sm
                 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
    >
      {children}
    </Link>
  );
}
