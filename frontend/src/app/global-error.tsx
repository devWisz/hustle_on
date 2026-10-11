"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[hustleon] fatal error", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center">
        <main className="mx-auto w-full max-w-2xl px-6 py-20">
          <p className="text-eyebrow">Something went wrong</p>
          <h1 className="text-headline mt-5">Hustle On could not load.</h1>
          <p className="text-lede mt-5 text-fg-muted">
            This is on our side, not yours. Trying again usually fixes it.
          </p>
          {error.digest ? (
            <p className="mt-4 font-mono text-[12px] text-fg-subtle">Reference {error.digest}</p>
          ) : null}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="h-12 rounded-full bg-accent px-6 text-[15px] font-medium text-accent-fg"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="flex h-12 items-center justify-center rounded-full border border-border px-6 text-[15px] font-medium"
            >
              Back home
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
