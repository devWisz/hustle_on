"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_COOKIE, GUEST_MAX_AGE_SECONDS, safeNext } from "./guest";

/**
 * Turns guest preview on and off.
 *
 * These are server actions rather than links so the cookie is written by a
 * POST: a GET that changes state gets fired by a prefetch, a link preview or a
 * crawler, and a visitor would find themselves in preview mode without having
 * asked. Being form submissions also means both still work with no JavaScript.
 */

export async function enterGuestPreview(formData: FormData): Promise<void> {
  const store = await cookies();
  store.set({
    name: GUEST_COOKIE,
    value: "1",
    path: "/",
    sameSite: "lax",
    maxAge: GUEST_MAX_AGE_SECONDS,
    // Readable on purpose: it is a display preference, not a credential, and
    // nothing is authorised by its presence.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  redirect(safeNext(formData.get("next")));
}

export async function exitGuestPreview(formData: FormData): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  redirect(safeNext(formData.get("next")));
}
