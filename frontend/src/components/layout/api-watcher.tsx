"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { API_URL } from "@/lib/api/client";
import { useToast } from "./toast";

const POLL_MS = 15000;

export function ApiWatcher() {
  const router = useRouter();
  const { success } = useToast();

  useEffect(() => {
    let stopped = false;
    async function probe() {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`${API_URL}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok && !stopped) {
          stopped = true;
          success("The API is back. Loading live data.");
          router.refresh();
        }
      } catch {
        return;
      }
    }
    const timer = setInterval(probe, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router, success]);

  return null;
}
