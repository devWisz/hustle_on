"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Textarea } from "./ui";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "stolen_work", label: "Not their work" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "impersonation", label: "Impersonation" },
  { value: "illegal", label: "Illegal" },
  { value: "other", label: "Something else" },
] as const;

/**
 * Reporting is available on every piece of content, one click away, and it
 * confirms without saying whether the subject had been reported before — that
 * would tell a bad actor how close they are to a review.
 */
export function ReportButton({
  subjectType,
  subjectId,
  signedIn,
}: {
  subjectType: "video" | "comment" | "user" | "job";
  subjectId: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("spam");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (!signedIn) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    try {
      await api("/v1/reports", { body: { subjectType, subjectId, reason, detail } });
    } finally {
      setState("sent");
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Report
      </Button>
    );
  }

  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-surface p-4">
      {state === "sent" ? (
        <p className="text-[13px] text-fg-muted">
          Thanks. A moderator will review this.{" "}
          <button type="button" onClick={() => setOpen(false)} className="underline underline-offset-4">
            Close
          </button>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Reason" htmlFor="report-reason">
            <select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
            >
              {REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detail" htmlFor="report-detail" hint="Optional. What should a moderator look at?">
            <Textarea
              id="report-detail"
              rows={2}
              maxLength={2000}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={state === "sending"}>
              Send report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
