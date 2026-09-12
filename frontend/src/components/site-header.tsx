import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { SessionResponse } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { SiteHeaderClient } from "./site-header-client";

/**
 * The site header (server component).
 *
 * It renders on the server so the signed-in state is correct on first paint —
 * a header that flashes "Sign in" and then swaps to an avatar is the single
 * most noticeable way an app looks unfinished.
 *
 * The interactive parts (mobile drawer, search) live in site-header-client.tsx
 * behind a "use client" boundary. This file stays a server component so it can
 * resolve the session with an async fetch before anything is sent to the browser.
 */
export async function SiteHeader() {
  const [session, guest] = await Promise.all([
    apiServer<SessionResponse>("/v1/auth/session", 0),
    isGuestPreview(),
  ]);
  const user = session?.authenticated ? session.user : undefined;
  return <SiteHeaderClient user={user} guest={guest} />;
}

/** Shown while the server component above is still resolving the session. */
export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Sardhana
        </Link>
      </div>
    </header>
  );
}
