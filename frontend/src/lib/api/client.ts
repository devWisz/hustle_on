import type { ApiErrorBody } from "../types";

const CONFIGURED_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085").replace(
  /\/+$/,
  "",
);

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * The API's base URL, as seen from wherever this code is running.
 *
 * On loopback it follows the page's own hostname. `localhost` and `127.0.0.1` are
 * the same server, but to a browser they are different *sites* — and a request from
 * one to the other is cross-site, so a `SameSite=Lax` session cookie is not sent at
 * all. The symptom is nasty: pages render signed in, because the server does its own
 * fetching, while everything the browser tries comes back unauthenticated. Matching
 * the hostname is what makes the session work in the browser as well as on the
 * server.
 *
 * The server side keeps the configured value: it has no page to follow.
 */
export function apiUrl(): string {
  if (typeof window === "undefined") return CONFIGURED_API_URL;
  try {
    const configured = new URL(CONFIGURED_API_URL);
    const here = window.location.hostname;
    if (isLoopbackHost(configured.hostname) && isLoopbackHost(here) && configured.hostname !== here) {
      configured.hostname = here;
      return configured.toString().replace(/\/+$/, "");
    }
  } catch {
    // A malformed configured URL is used as-is, so the failure is a visible one at
    // the request rather than a silent redirection to somewhere unintended.
  }
  return CONFIGURED_API_URL;
}
export const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "hustleon_session";
export const FETCH_TIMEOUT_MS = 8000;

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

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const prefix = `${SESSION_COOKIE}_csrf=`;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : "";
}

/**
 * The CSRF header, for the rare request that does not go through `api()`.
 *
 * A video upload is sent with XMLHttpRequest so the form can show progress, and
 * in local development the storage endpoint is part of our own API. When that URL
 * is same-origin the browser attaches the session cookie, which means the API
 * will demand the double-submit token — so this request has to carry it, exactly
 * like every other state-changing call.
 *
 * Returns an empty object rather than a blank header when there is no token, so a
 * signed-out caller sends nothing instead of sending nothing useful.
 */
export function csrfHeader(): Record<string, string> {
  const token = csrfToken();
  return token ? { "X-Hustleon-CSRF": token } : {};
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const method = rest.method ?? (body ? "POST" : "GET");

  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    const token = csrfToken();
    if (token) requestHeaders.set("X-Hustleon-CSRF", token);
  }

  const response = await fetch(`${apiUrl()}${path}`, {
    ...rest,
    method,
    headers: requestHeaders,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: rest.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, parsed as ApiErrorBody | null, response.statusText);
  }
  return parsed as T;
}
