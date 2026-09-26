import "server-only";
import { cookies } from "next/headers";
import { API_URL } from "./client";

const SERVER_TIMEOUT_MS = 2500;

export async function apiServer<T>(path: string, revalidate = 30): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      next: { revalidate },
      signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
