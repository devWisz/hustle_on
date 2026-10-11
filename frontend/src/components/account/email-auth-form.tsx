"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { Button, Field, Input } from "../ui";

type Mode = "signin" | "signup";

/**
 * Sign in or create an account with an email address and a password.
 *
 * This is the path most people expect, and it needs no wallet and no email
 * delivery — nothing is sent, so nothing has to arrive. The one honest
 * consequence is that a forgotten password cannot be reset, because there is no
 * way to prove the address belongs to whoever is asking. The password can be
 * changed while signed in, and an operator can set a new one from the machine that
 * holds the database. The form says so rather than pretending otherwise.
 */
export function EmailAuthForm({ next, className }: { next?: string; className?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const signingUp = mode === "signup";

  function switchMode() {
    setMode(signingUp ? "signin" : "signup");
    setFormError(null);
    setFields({});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFields({});
    try {
      await api(signingUp ? "/v1/auth/signup" : "/v1/auth/login", {
        body: signingUp
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password },
      });
      // The session is a cookie the server just set, so the server-rendered pages
      // have to be re-fetched, not merely navigated to.
      router.push(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        // Per-field messages come back keyed by input, so each one lands beside
        // the box it is about instead of in a banner at the top.
        if (Object.keys(err.fields).length > 0) setFields(err.fields);
        else setFormError(err.message);
      } else {
        setFormError("Could not reach the sign-in service. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex gap-2">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => (mode === m ? undefined : switchMode())}
            aria-pressed={mode === m}
            className={
              mode === m
                ? "press rounded-full border border-fg bg-fg px-3.5 py-1.5 text-[13px] font-medium text-bg"
                : "press rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            }
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {signingUp ? (
          <Field label="Your name" htmlFor="name" error={fields.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </Field>
        ) : null}

        <Field label="Email address" htmlFor="email" error={fields.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={fields.password}
          hint={signingUp ? "At least 10 characters. Length is what makes it strong." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={signingUp ? "Choose a password" : "Your password"}
          />
        </Field>
      </div>

      {formError ? (
        <p role="alert" className="mt-4 text-[13px] leading-relaxed text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>
        {signingUp ? "Create account" : "Sign in"}
      </Button>

      {!signingUp ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-fg-subtle">
          Forgotten your password? Nothing is emailed, so there is no reset link — ask the operator
          to run <code className="font-mono">cmd/setpassword</code>. See{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            how accounts work
          </Link>
          .
        </p>
      ) : (
        <p className="mt-3 text-[12.5px] leading-relaxed text-fg-subtle">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            Privacy Policy
          </Link>
          . No password is stored in readable form, and nothing is emailed to you.
        </p>
      )}
    </form>
  );
}
