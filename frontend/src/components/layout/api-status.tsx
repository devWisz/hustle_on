"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { API_URL } from "@/lib/api";
import { cx } from "@/lib/format";

/** Long enough not to hammer a server that is starting up. */
const POLL_MS = 8000;

/**
 * Says the live feed is offline, then quietly waits for it to come back.
 *
 * The page underneath is already showing the demo library, so nothing here is
 * urgent: it polls the API's health endpoint and, the moment it answers,
 * re-renders the page on the server so real records replace the demo ones
 * without a reload. The retry button does the same thing on demand.
 */
export function ApiStatus({ className }: { className?: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [back, setBack] = useState(false);
  const [refreshing, startTransition] = useTransition();

  useEffect(() => {
    let stopped = false;

    async function probe() {
      if (stopped || document.hidden) return;
      setChecking(true);
      try {
        const res = await fetch(`${API_URL}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok && !stopped) {
          stopped = true;
          setBack(true);
          startTransition(() => router.refresh());
        }
      } catch {
        // Still down; the next tick tries again.
      } finally {
        setChecking(false);
      }
    }

    const timer = setInterval(probe, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  return (
    <div
      role="status"
      className={cx(
        "animate-fade-in flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3",
        "sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="flex items-start gap-3 text-[13px] leading-relaxed text-fg-muted">
        <span
          aria-hidden
          className={cx(
            "mt-[7px] h-2 w-2 shrink-0 rounded-full",
            back ? "bg-accent" : "animate-blink bg-warning",
          )}
        />
        <span>
          {back ? (
            <span className="font-medium text-fg">Connected. Loading the live feed.</span>
          ) : (
            <>
              <span className="font-medium text-fg">The live feed is offline.</span> You are
              looking at the demo library in the meantime, and this page switches over by itself
              when the API is back.
            </>
          )}
        </span>
      </p>
      {back ? null : (
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          disabled={refreshing || checking}
          className="press inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border px-3.5
                     text-[12.5px] font-medium text-fg transition-colors hover:border-border-strong
                     hover:bg-surface-raised disabled:opacity-60"
        >
          {refreshing || checking ? "Checking" : "Try again"}
        </button>
      )}
    </div>
  );
}
