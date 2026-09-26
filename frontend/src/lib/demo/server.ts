import "server-only";
import { cookies } from "next/headers";
import { DEMO_COOKIE } from "./cookie";

export async function hasDemoCookie(): Promise<boolean> {
  return (await cookies()).has(DEMO_COOKIE);
}
