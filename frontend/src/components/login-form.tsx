"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Field, Input } from "./ui";

/**
 * Requests an email login link.
 *
 * The success message is identical whether or not the address has an account,
 * matching the API. Saying "no account with that email" here would undo the
 * work the server does to avoid confirming who is registered.
 */
export function LoginForm({ next, className }: { next?: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api("/v1/auth/request-link", { body: { email, next: next ?? "" } });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(
        err instanceof ApiError
          ? (err.fields.email ?? err.message)
          : "We could not send that link. Try again in a moment.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className={className}>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            If <span className="font-medium text-fg">{email}</span> has an account, a sign-in link
            is on its way. It works once and expires in fifteen minutes.
          </p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="mt-4 text-[13px] text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <Field label="Email" htmlFor="email" error={error ?? undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-4 w-full" loading={state === "sending"}>
        Send sign-in link
      </Button>
    </form>
  );
}
