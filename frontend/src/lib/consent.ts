export type Consent = "essential" | "all";

export const CONSENT_COOKIE = "sardhana_consent";
export const CONSENT_EVENT = "sardhana:consent";
export const OPEN_COOKIE_SETTINGS = "sardhana:cookie-settings";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const PREFERENCE_KEYS = ["theme", "sardhana-recent-searches", "sardhana-bookmarks"];

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
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}
