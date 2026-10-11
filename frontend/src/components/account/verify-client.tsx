"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { safeNext } from "@/lib/redirect";
import type { SelfUser } from "@/lib/types";
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

    api<SelfUser>("/v1/auth/verify", { body: { token } })
      .then((me) => {
        const wanted = safeNext(params.get("next"), "/dashboard");
        // A brand-new account has no name of its own yet — the sign-in flow built
        // one out of the email address — so it is sent to choose one first, with
        // wherever it was going remembered.
        const destination = me?.onboarded
          ? wanted
          : `/welcome?next=${encodeURIComponent(wanted)}`;
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
