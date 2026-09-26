"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { ButtonLink, Spinner } from "../ui";

export function VerifyClient() {
  const params = useSearchParams();
  const attempted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = params.get("token");
    if (!token) {
      setError("That link is missing its token. Request a new one.");
      return;
    }

    api("/v1/auth/verify", { body: { token } })
      .then(() => {
        const next = params.get("next");
        const destination =
          next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
        window.location.replace(destination);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "That sign-in link is no longer valid. Request a new one.",
        );
      });
  }, [params]);

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-[20px] font-semibold">Sign-in failed</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{error}</p>
        <ButtonLink href="/login" className="mt-6">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  return <Spinner label="Signing you in" />;
}
