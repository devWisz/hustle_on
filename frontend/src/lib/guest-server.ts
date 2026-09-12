import { GUEST_COOKIE } from "./guest";

/**
 * Whether this request is a guest preview.
 *
 * Server-only: it reads the request's cookies. It is kept apart from
 * `lib/guest.ts` so the edge middleware can import the constants there without
 * dragging `next/headers` into a runtime that has no such thing.
 */
export async function isGuestPreview(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  return (await cookies()).has(GUEST_COOKIE);
}
