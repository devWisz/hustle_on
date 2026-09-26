"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ButtonLink, SpinnerCard } from "./ui";

/**
 * Consumes a magic-link token.
 *
 * The token arrives in the URL, so the exchange happens immediately and the
 * browser is then replaced onto a clean path — a URL carrying a login token
 * should not stay in history, or in the Referer of the next request.
 */
export function VerifyClient() {
  const router = useRouter();
  const params = useSearchParams();
  const attempted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guarded because React runs effects twice in development, and this token
    // is single use: a second exchange would fail against a valid login.
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
        router.replace(destination);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "That sign-in link is no longer valid. Request a new one.",
        );
      });
  }, [params, router]);

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

  return <SpinnerCard label="Signing you in" />;
}
