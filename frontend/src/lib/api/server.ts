import "server-only";
import { cookies, headers } from "next/headers";
import { apiUrl } from "./client";
import type { Page } from "../types";

const SERVER_TIMEOUT_MS = 6000;
// On the server there is no page to follow, so this is the configured origin —
// `apiUrl()` returns exactly that when `window` does not exist.
const SERVER_API_URL = process.env.API_ORIGIN?.replace(/\/+$/, "") || apiUrl();
const PROXY_SECRET = process.env.INTERNAL_PROXY_SECRET ?? "";

export interface ApiResult<T> {
  data: T | null;
  status: number;
}

async function requestHeaders(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) out.cookie = cookieHeader;
  if (PROXY_SECRET) {
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) {
      out["X-Hustleon-Client-IP"] = ip;
      out["X-Hustleon-Proxy-Key"] = PROXY_SECRET;
    }
  }
  return out;
}

export async function apiServerResult<T>(path: string, revalidate = 30): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, {
      headers: await requestHeaders(),
      next: { revalidate },
      signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
    });
    if (!response.ok) return { data: null, status: response.status };
    return { data: (await response.json()) as T, status: response.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export async function apiServer<T>(path: string, revalidate = 30): Promise<T | null> {
  return (await apiServerResult<T>(path, revalidate)).data;
}

/**
 * Follows `nextCursor` and returns every page as one collection.
 *
 * The API bounds every list, which is the point of paging it — but an operator
 * console is a surface that legitimately needs the whole set (every member, the
 * whole ledger) and used to ask for it with one enormous `limit`. This walks the
 * cursor instead, so the bound stays on the server and the console still shows
 * everything.
 *
 * `maxPages` is a stop, not a target: it keeps a runaway dataset from turning one
 * page render into an unbounded number of API calls. When it is reached the
 * caller gets what was fetched, and the API remains the record of what exists.
 *
 * Returns null only when the first page could not be read at all, so a caller can
 * still tell "nothing here" from "the API is unreachable".
 */
export async function apiServerAllPages<T>(
  path: string,
  revalidate = 30,
  maxPages = 10,
): Promise<Page<T> | null> {
  const items: T[] = [];
  let cursor = "";

  for (let page = 0; page < maxPages; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const url = cursor ? `${path}${separator}cursor=${encodeURIComponent(cursor)}` : path;
    const result = await apiServerResult<Page<T>>(url, revalidate);
    if (!result.data) return page === 0 ? null : { items };

    items.push(...(result.data.items ?? []));
    cursor = result.data.nextCursor ?? "";
    if (!cursor) break;
  }
  return { items };
}
