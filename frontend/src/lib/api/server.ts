import "server-only";
import { cookies, headers } from "next/headers";
import { API_URL } from "./client";

const SERVER_TIMEOUT_MS = 6000;
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
      out["X-Sardhana-Client-IP"] = ip;
      out["X-Sardhana-Proxy-Key"] = PROXY_SECRET;
    }
  }
  return out;
}

export async function apiServerResult<T>(path: string, revalidate = 30): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
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
