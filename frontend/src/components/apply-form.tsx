"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { CheckIcon } from "./icons";

/** Applying to a role, with the option to point at sessions as evidence. */
export function ApplyForm({
  slug,
  signedIn,
  className,
}: {
  slug: string;
  signedIn: boolean;
  className?: string;
}) {
  const [coverNote, setCoverNote] = useState("");
  const [rate, setRate] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Card className={className}>
        <div className="p-5 text-sm text-fg-muted">
          <Link href={`/login?next=/jobs/${slug}`} className="font-medium text-fg underline underline-offset-4">
            Sign in
          </Link>{" "}
          to apply. Your published sessions come with the application.
        </div>
      </Card>
    );
  }

  if (state === "sent") {
    return (
      <Card className={className}>
        <div className="flex items-center gap-2 p-5 text-accent">
          <CheckIcon size={18} />
          <p className="text-sm font-medium">Application sent</p>
        </div>
      </Card>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api(`/v1/jobs/${slug}/applications`, {
        body: {
          coverNote: coverNote.trim(),
          portfolioVideoIds: [],
          rateUsd: rate ? Number(rate) : null,
        },
      });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiError ? err.message : "That application could not be sent.");
    }
  }

  return (
    <Card className={className} as="section">
      <form onSubmit={submit} className="space-y-5 p-6">
        <h2 className="text-[17px] font-semibold">Apply</h2>
        <Field
          label="Cover note"
          htmlFor="coverNote"
          hint="What you would do first, and which of your sessions is closest to this work."
        >
          <Textarea
            id="coverNote"
            rows={5}
            maxLength={3000}
            value={coverNote}
            onChange={(event) => setCoverNote(event.target.value)}
          />
        </Field>
        <Field label="Your rate in USD" htmlFor="rate" hint="Optional.">
          <Input
            id="rate"
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={state === "sending"} disabled={!coverNote.trim()}>
            Send application
          </Button>
        </div>
      </form>
    </Card>
  );
}
