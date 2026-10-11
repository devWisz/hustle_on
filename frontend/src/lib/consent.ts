import { endGuestSession } from "./guest";

export type Consent = "essential" | "all";

export const CONSENT_COOKIE = "hustleon_consent";
export const CONSENT_EVENT = "hustleon:consent";
export const OPEN_COOKIE_SETTINGS = "hustleon:cookie-settings";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

// The keys this site is allowed to remember. Saved sessions used to be on this
// list; they are on the account now, so choosing "essential only" no longer has
// a bookmark list to delete.
const PREFERENCE_KEYS = ["theme", "hustleon-recent-searches"];

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  const value = hit?.slice(CONSENT_COOKIE.length + 1);
  return value === "essential" || value === "all" ? value : null;
}

export function canRemember(): boolean {
  return readConsent() === "all";
}

export function writeConsent(value: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  if (value === "essential") {
    for (const key of PREFERENCE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        break;
      }
    }
    // Guest mode is a convenience, not something the site needs to work, so
    // "essential only" forgets it too — otherwise choosing not to be remembered
    // would leave a cookie behind saying how they were browsing.
    endGuestSession();
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}
