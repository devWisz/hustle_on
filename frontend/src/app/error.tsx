"use client";

import { useEffect } from "react";
import { Button, Container } from "@/components/ui";

/**
 * The route error boundary. It shows what a visitor can do next and nothing
 * about what went wrong internally — an error message from the server is for
 * the logs, not for the page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sardhana] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <Container width="narrow" className="py-24 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">
        This page failed to load. Trying again usually resolves it.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-[11px] text-fg-subtle">Reference {error.digest}</p>
      ) : null}
      <div className="mt-8">
        <Button onClick={reset}>Try again</Button>
      </div>
    </Container>
  );
}
