import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Notification, Page, SelfUser } from "@/lib/types";
import { Avatar, ButtonLink } from "./ui";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { UploadIcon } from "./icons";

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export const navigation = [
  { href: "/discover", label: "Discover" },
  { href: "/hire", label: "Hire" },
  { href: "/jobs", label: "Roles" },
] as const;

/**
 * The site header, rendered on the server so the signed-in state is correct on
 * first paint — no flash of the signed-out navigation while a client fetch
 * resolves.
 */
export async function SiteHeader() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  const user = session?.authenticated ? session.user : undefined;

  // Fetched here rather than in the bell so the unread count is right on first
  // paint. A badge that only appears once you open the panel tells you nothing.
  const notifications = user
    ? await apiServer<Page<Notification>>("/v1/me/notifications?limit=8", 0)
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="HustlerOn home">
          <Mark />
          <span className="text-[15px] font-semibold tracking-tight">HustlerOn</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-control)] px-3 py-1.5 text-sm text-fg-muted
                         transition-colors hover:bg-surface-raised hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette />
          {user ? (
            <>
              <ButtonLink
                href="/upload"
                variant="secondary"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <UploadIcon size={16} />
                Upload
              </ButtonLink>
              <NotificationBell initialItems={notifications?.items ?? []} />
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-surface-raised"
                aria-label={`Signed in as ${user.displayName}`}
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size={28} />
                <span className="hidden text-sm text-fg-muted lg:inline">{user.handle}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-[var(--radius-control)] px-3 py-1.5 text-sm text-fg-muted
                           transition-colors hover:text-fg sm:inline-flex"
              >
                Sign in
              </Link>
              <ButtonLink href="/login?intent=start" size="sm">
                Start publishing
              </ButtonLink>
            </>
          )}
          <ThemeToggle />
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}

/** The wordmark's glyph: three ascending bars, for sessions stacking up. */
function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-accent">
      <rect x="2" y="11" width="4" height="7" rx="1.2" fill="currentColor" opacity="0.45" />
      <rect x="8" y="7" width="4" height="11" rx="1.2" fill="currentColor" opacity="0.7" />
      <rect x="14" y="2" width="4" height="16" rx="1.2" fill="currentColor" />
    </svg>
  );
}
