import type { ApiErrorBody } from "../types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085";
export const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "sardhana_session";
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
    if (token) requestHeaders.set("X-Sardhana-CSRF", token);
  }

  const response = await fetch(`${API_URL}${path}`, {
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
