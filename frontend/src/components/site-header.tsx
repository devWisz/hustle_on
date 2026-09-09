import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { SessionResponse } from "@/lib/types";
import { Avatar, ButtonLink } from "./ui";
import { ThemeToggle } from "./theme-toggle";

/**
 * The site header.
 *
 * It renders on the server so the signed-in state is correct on first paint —
 * a header that flashes "Sign in" and then swaps to an avatar is the single
 * most noticeable way an app looks unfinished.
 */
export async function SiteHeader() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  const user = session?.authenticated ? session.user : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-5 sm:px-6">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-5 text-sm sm:flex">
          <NavLink href="/">Timelapses</NavLink>
          {user ? <NavLink href="/dashboard">Dashboard</NavLink> : null}
          {user?.role === "admin" ? <NavLink href="/admin">Review</NavLink> : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <ButtonLink href="/upload" size="sm">
                Upload
              </ButtonLink>
              <Link
                href={`/creator/${user.handle}`}
                className="rounded-full transition-opacity hover:opacity-80"
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
        </div>
      </div>
    </header>
  );
}

/** Shown while the server component above is still resolving the session. */
export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5 sm:px-6">
        <Wordmark />
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="text-[15px] font-semibold tracking-tight">
      Sardhana
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-fg-muted transition-colors hover:text-fg">
      {children}
    </Link>
  );
}
