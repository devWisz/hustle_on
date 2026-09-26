"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Container } from "@/components/ui";

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
    <Container width="wide" className="py-20 sm:py-32">
      <p className="text-eyebrow">Something went wrong</p>
      <h1 className="text-headline mt-5 max-w-3xl">This page failed to load.</h1>
      <p className="text-lede mt-5 max-w-xl text-fg-muted">Trying again usually fixes it.</p>
      {error.digest ? (
        <p className="mt-4 font-mono text-[12px] text-fg-subtle">Reference {error.digest}</p>
      ) : null}
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          Back home
        </ButtonLink>
      </div>
    </Container>
  );
}
