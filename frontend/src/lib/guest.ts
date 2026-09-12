/**
 * Guest preview.
 *
 * A visitor can look around the whole product before deciding whether to make
 * an account: the feed, a watch page, a creator profile, the dashboard, the
 * settings screen and the submission form. What they cannot do is write
 * anything, because there is no account for a write to belong to.
 *
 * The cookie set here is a preference, not a credential. It unlocks nothing on
 * the API — every endpoint still answers an unauthenticated request the way it
 * always did — it only tells the pages to render their preview state instead
 * of bouncing to the sign-in screen. That distinction is the whole safety
 * argument: forging this cookie gets you the same sample data anyone else can
 * see by clicking the button.
 */

export const GUEST_COOKIE = "sardhana_guest";

/** Long enough to finish looking around, short enough not to linger. */
export const GUEST_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Routes a guest may preview. The review queue is deliberately not one. */
export const GUEST_PREVIEWABLE = ["/dashboard", "/settings", "/upload"] as const;

export function isGuestPreviewable(pathname: string): boolean {
  return GUEST_PREVIEWABLE.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Narrows a redirect target to somewhere on this site.
 *
 * A `next` value arrives from the query string, so it is attacker-controlled.
 * Anything that is not a plain absolute path — a full URL, a protocol-relative
 * `//evil.example` — is discarded rather than followed.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}
