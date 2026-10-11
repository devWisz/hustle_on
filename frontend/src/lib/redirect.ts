/**
 * Narrow a redirect target to a path on this site.
 *
 * A `next` parameter arrives from the query string, so it is untrusted. Only a
 * single-slash path is accepted: protocol-relative (`//host`) and backslash
 * variants are rejected so a crafted link cannot send someone off-site.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}
