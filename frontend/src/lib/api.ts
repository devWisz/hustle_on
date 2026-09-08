import type { ApiErrorBody } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085";

/** Shared session cookie name. Must match the API default. */
export const SESSION_COOKIE =
  process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "hustler_on_session";

/** Fail fast so a missing API cannot stall the whole page. */
const FETCH_TIMEOUT_MS = 4000;

/** An error carrying the API's stable code and any per-field messages. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error?.message ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "unknown";
    this.fields = body?.error?.fields ?? {};
    this.requestId = body?.requestId;
  }
}

/**
 * Reads the CSRF token the API set alongside the session cookie.
 *
 * The session cookie itself is HttpOnly and unreadable here, which is the
 * point: this token is a separate, readable value that only a page on our own
 * origin can echo back in a header.
 */
function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const name = `${SESSION_COOKIE}_csrf=`;
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name) || c.startsWith("sardhana_session_csrf=") || c.includes("_csrf="));
  if (hit) {
    const eq = hit.indexOf("=");
    return eq !== -1 ? decodeURIComponent(hit.slice(eq + 1)) : "";
  }
  return "";
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Passed through to Next's fetch cache for server components. */
  revalidate?: number;
}

/**
 * Calls the API.
 *
 * `credentials: "include"` sends the session cookie; every state-changing
 * request also carries the CSRF header, which the API checks alongside the
 * Origin. Both are required, so neither alone is enough for a cross-site page.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, revalidate, headers, ...rest } = options;
  const method = rest.method ?? (body ? "POST" : "GET");

  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    const token = csrfToken();
    if (token) requestHeaders.set("X-Sardhana-CSRF", token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    method,
    headers: requestHeaders,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: rest.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...(revalidate === undefined ? {} : { next: { revalidate } }),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, parsed as ApiErrorBody | null, response.statusText);
  }
  return parsed as T;
}

/**
 * Server-component fetch. It forwards the visitor's cookies so a page rendered
 * on the server sees exactly what that visitor is allowed to see, and it never
 * throws — a page should degrade to an empty state rather than a crash when the
 * API is briefly unavailable.
 */
export async function apiServer<T>(path: string, revalidate = 30): Promise<T | null> {
  const { cookies } = await import("next/headers");
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
