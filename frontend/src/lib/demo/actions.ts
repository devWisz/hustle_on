"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, DEMO_MAX_AGE_SECONDS, safeNext } from "./cookie";

export async function enterDemo(formData: FormData): Promise<void> {
  const store = await cookies();
  store.set({
    name: DEMO_COOKIE,
    value: "1",
    path: "/",
    sameSite: "lax",
    maxAge: DEMO_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  redirect(safeNext(formData.get("next")));
}

export async function exitDemo(formData: FormData): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect(safeNext(formData.get("next")));
}
