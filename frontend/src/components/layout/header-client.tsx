"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, ButtonLink, buttonClass } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { SearchBar } from "./search-bar";
import { cx } from "@/lib/format";
import { CloseIcon, EyeIcon, MenuIcon } from "./icons";

/**
 * The client half of the site header.
 *
 * It handles the mobile drawer and the active-route marking. The server
 * wrapper (site-header.tsx) resolves the session and the preview state and
 * passes both here, so the header is already correct on first paint — a header
 * that flashes "Sign in" and then swaps to an avatar is the single most
 * noticeable way an app looks unfinished.
 */

interface HeaderUser {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  role: "member" | "admin";
}

export function SiteHeaderClient({ user, guest = false }: { user?: HeaderUser; guest?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // The drawer is a modal layer: it closes on Escape, it closes when the route
  // underneath it changes, and the page behind it does not scroll while it is
  // open. Leaving any one of those out is what makes a drawer feel homemade.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const close = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-5 px-5 sm:px-6">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-5 text-sm sm:flex">
          <NavLink href="/" current={pathname === "/"}>
            Timelapses
          </NavLink>
          <NavLink href="/about" current={pathname === "/about"}>
            About
          </NavLink>
          {user ? (
            <NavLink href="/dashboard" current={pathname.startsWith("/dashboard")}>
              Dashboard
            </NavLink>
          ) : null}
          {user?.role === "admin" ? (
            <NavLink href="/admin" current={pathname.startsWith("/admin")}>
              Review
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <ThemeToggle />

          {user ? (
            <>
              <ButtonLink href="/upload" size="sm" className="hidden sm:inline-flex">
                Upload
              </ButtonLink>
              <Link
                href={`/creator/${user.handle}`}
                className="rounded-full ring-offset-2 ring-offset-bg transition-all duration-200
                           hover:ring-2 hover:ring-border-strong"
                aria-label={`Your profile, ${user.displayName}`}
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size={30} />
              </Link>
            </>
          ) : (
            <>
              {guest ? (
                <span
                  className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-raised
                             px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted sm:inline-flex"
                >
                  <EyeIcon size={11} />
                  Guest
                </span>
              ) : null}
              <Link href="/login" className={buttonClass(guest ? "primary" : "secondary", "sm")}>
                {guest ? "Create an account" : "Sign in"}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)]
                       text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg sm:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon size={18} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            className="drawer-overlay fixed inset-0 z-50 bg-black/40 sm:hidden"
            onClick={close}
            aria-hidden
          />
          <nav
            aria-label="Menu"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border
                       bg-bg p-6 shadow-[var(--shadow-raised)] sm:hidden"
            style={{ animation: "slideInLeft 0.25s var(--ease-out-quint) forwards" }}
          >
            <div className="mb-8 flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={close}
                className="rounded-[var(--radius-control)] p-1.5 text-fg-subtle hover:bg-surface-raised hover:text-fg"
                aria-label="Close menu"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <MobileNavLink href="/" current={pathname === "/"} onClick={close}>
                Timelapses
              </MobileNavLink>
              <MobileNavLink href="/about" current={pathname === "/about"} onClick={close}>
                About
              </MobileNavLink>
              {user ? (
                <MobileNavLink
                  href="/dashboard"
                  current={pathname.startsWith("/dashboard")}
                  onClick={close}
                >
                  Dashboard
                </MobileNavLink>
              ) : null}
              {user?.role === "admin" ? (
                <MobileNavLink href="/admin" current={pathname.startsWith("/admin")} onClick={close}>
                  Review
                </MobileNavLink>
              ) : null}

              <div className="mt-4 border-t border-border pt-4">
                {user ? (
                  <>
                    <MobileNavLink href="/upload" current={pathname === "/upload"} onClick={close}>
                      Upload a timelapse
                    </MobileNavLink>
                    <MobileNavLink
                      href="/settings"
                      current={pathname === "/settings"}
                      onClick={close}
                    >
                      Settings
                    </MobileNavLink>
                    <MobileNavLink href={`/creator/${user.handle}`} current={false} onClick={close}>
                      Your profile
                    </MobileNavLink>
                  </>
                ) : guest ? (
                  <>
                    <MobileNavLink
                      href="/dashboard"
                      current={pathname.startsWith("/dashboard")}
                      onClick={close}
                    >
                      Dashboard preview
                    </MobileNavLink>
                    <MobileNavLink href="/upload" current={pathname === "/upload"} onClick={close}>
                      Submission form
                    </MobileNavLink>
                    <MobileNavLink href="/login" current={false} onClick={close}>
                      Create an account
                    </MobileNavLink>
                  </>
                ) : (
                  <MobileNavLink href="/login" current={false} onClick={close}>
                    Sign in
                  </MobileNavLink>
                )}
              </div>
            </div>

            <p className="mt-auto pt-8 text-[12px] text-fg-subtle">
              Press{" "}
              <kbd className="rounded border border-border bg-surface-raised px-1 py-0.5 font-mono text-[10px]">
                ?
              </kbd>{" "}
              for shortcuts
            </p>
          </nav>
        </>
      )}
    </header>
  );
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="shrink-0 text-[15px] font-semibold tracking-tight transition-colors hover:text-accent"
    >
      Sardhana
    </Link>
  );
}

/**
 * A top-level navigation link.
 *
 * The current page keeps its underline permanently rather than only on hover,
 * so the header answers "where am I" without being asked.
 */
function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cx(
        "relative transition-colors",
        "after:absolute after:bottom-[-18px] after:left-0 after:right-0 after:h-[2px]",
        "after:origin-left after:bg-accent after:transition-transform hover:after:scale-x-100",
        current ? "text-fg after:scale-x-100" : "text-fg-muted hover:text-fg after:scale-x-0",
      )}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  current,
  children,
  onClick,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex items-center rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors",
        current
          ? "bg-surface-raised font-medium text-fg"
          : "text-fg-muted hover:bg-surface-raised hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
