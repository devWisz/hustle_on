/**
 * Guest mode: browsing without an account.
 *
 * This is a display preference and nothing more. It tells the interface to stop
 * asking a visitor to sign in before they have looked around, and to explain
 * plainly what an account is for when they reach something that needs one.
 *
 * It is deliberately not a credential, and it is not a second kind of session:
 * every gated action is still gated by the API on the session cookie, so a guest
 * who forges this cookie gets exactly what the button hands out for free — a
 * browsing experience. The upload, notes, bookmarks, settings and admin routes
 * are unchanged by it.
 *
 * The name is not HttpOnly because the browser is what sets it, from the button
 * on the sign-in page.
 */
export const GUEST_COOKIE = "hustleon_guest";
export const GUEST_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Records the preference. Safe to call only in the browser. */
export function startGuestSession(): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=${GUEST_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

/** Forgets it, so the sign-in page is shown again on the next visit. */
export function endGuestSession(): void {
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
