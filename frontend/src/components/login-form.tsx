"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Field, Input } from "./ui";

/**
 * Requests an email login link.
 */
export function LoginForm({ next, className }: { next?: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setState("sending");
    setError(null);

    try {
      await api("/v1/auth/request-link", { body: { email: trimmed, next: next ?? "" } });
      setState("sent");
    } catch (err: unknown) {
      setState("idle");
      if (err instanceof ApiError) {
        if (err.status === 403 || err.message.toLowerCase().includes("csrf")) {
          setError("Security token expired. Reloading page...");
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
        setError(err.fields.email ?? err.message ?? "Could not send sign-in link.");
      } else if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
        setError("Could not reach authentication server. Ensure the API backend is online.");
      } else {
        setError("We could not send that link. Please check your email and try again.");
      }
    }
  }

  if (state === "sent") {
    return (
      <div className={className}>
        <div className="animate-scale-in rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex items-center gap-2 text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[12px] font-semibold">Link sent</span>
          </div>
          <h2 className="text-[16px] font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            If <span className="font-medium text-fg">{email}</span> has an account, a sign-in link
            is on its way. It works once and expires in 15 minutes.
          </p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="link-underline mt-4 text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <Field label="Email address" htmlFor="email" error={error ?? undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-4 w-full" loading={state === "sending"}>
        Send sign-in link
      </Button>
    </form>
  );
}
