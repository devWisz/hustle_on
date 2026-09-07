/** API access for the admin console. Mirrors the public app's client. */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const name = `${process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "sardhana_session"}_csrf=`;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name));
  return hit ? decodeURIComponent(hit.slice(name.length)) : "";
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? (options.body ? "POST" : "GET");
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers.set("X-Sardhana-CSRF", token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (parsed as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
    throw new ApiError(response.status, message);
  }
  return parsed as T;
}

/**
 * Server-side fetch with the operator's cookies forwarded.
 *
 * Unlike the public site this returns the status, because an admin page must
 * distinguish "not signed in" from "signed in without the role" — one is a
 * login prompt, the other is a refusal.
 */
export async function apiServer<T>(
  path: string,
): Promise<{ data: T | null; status: number }> {
  const { cookies } = await import("next/headers");
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return { data: null, status: response.status };
    return { data: (await response.json()) as T, status: response.status };
  } catch {
    return { data: null, status: 0 };
  }
}
