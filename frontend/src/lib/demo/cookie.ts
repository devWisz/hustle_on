export const DEMO_COOKIE = "sardhana_guest";
export const DEMO_MAX_AGE_SECONDS = 60 * 60 * 12;

export function safeNext(value: unknown, fallback = "/"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}
