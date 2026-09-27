"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, api } from "@/lib/api/client";
import { cx } from "@/lib/format";
import type { ReportReason } from "@/lib/types";
import { useToast } from "../layout/toast";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { Button, Textarea } from "../ui";
import { AlertIcon, CloseIcon } from "../ui/icons";

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "not_their_work", label: "Not their work", hint: "Someone else's recording or project" },
  { value: "misleading", label: "Misleading", hint: "The write-up does not match the recording" },
  { value: "inappropriate", label: "Inappropriate", hint: "Explicit, violent or private content" },
  { value: "harassment", label: "Harassment or hate", hint: "Targets a person or group" },
  { value: "spam", label: "Spam", hint: "Advertising, scams or repeated posts" },
  { value: "other", label: "Something else", hint: "Tell us below" },
];

export function ReportButton({
  slug,
  noteId,
  signedIn,
  demo = false,
  compact = false,
}: {
  slug: string;
  noteId?: string;
  signedIn: boolean;
  demo?: boolean;
  compact?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const subject = noteId ? "note" : "session";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useGSAP(
    () => {
      if (!open || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(panel.current, { y: 16, autoAlpha: 0, duration: 0.4 });
      });
    },
    { dependencies: [open] },
  );

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      await api("/v1/reports", {
        method: "POST",
        body: { slug, noteId: noteId ?? "", reason, details: details.trim() },
      });
      toast.success("Thanks. An admin will look at it.");
      setOpen(false);
      setReason(null);
      setDetails("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That report did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          demo ? toast.success("Reports are switched off in the demo.") : setOpen(true)
        }
        className={cx(
          "press inline-flex items-center gap-1.5 text-fg-subtle transition-colors hover:text-danger",
          compact
            ? "rounded-full p-1 text-[11px]"
            : "h-8 rounded-full px-3 text-[13px] font-medium",
        )}
        aria-label={`Report this ${subject}`}
        title={`Report this ${subject}`}
      >
        <AlertIcon size={compact ? 13 : 15} />
        {compact ? null : "Report"}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-title"
                className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-surface p-5 shadow-[var(--shadow-lifted)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 id="report-title" className="text-[17px] font-semibold">
                    Report this {subject}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="press -m-1 rounded-full p-1.5 text-fg-subtle hover:bg-surface-raised hover:text-fg"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>

                {!signedIn ? (
                  <div className="mt-3">
                    <p className="text-[14px] leading-relaxed text-fg-muted">
                      Reports come from signed-in people, so an admin can follow up if they need to.
                    </p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/watch/${slug}`)}`}
                      className="mt-5 inline-flex h-10 items-center rounded-full bg-inverse px-5 text-sm font-medium text-inverse-fg"
                    >
                      Sign in to report
                    </Link>
                  </div>
                ) : (
                  <>
                    <p className="mt-1.5 text-[13.5px] text-fg-muted">
                      Only admins see reports. The creator is not told who sent it.
                    </p>
                    <fieldset className="mt-5 space-y-2">
                      <legend className="sr-only">Reason</legend>
                      {REASONS.map((r) => (
                        <label
                          key={r.value}
                          className={cx(
                            "flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border p-3 transition-colors",
                            reason === r.value
                              ? "border-fg bg-surface-raised"
                              : "border-border hover:border-border-strong",
                          )}
                        >
                          <input
                            type="radio"
                            name="reason"
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                            className="mt-1 accent-[var(--accent)]"
                          />
                          <span>
                            <span className="block text-[14px] font-medium">{r.label}</span>
                            <span className="block text-[12.5px] text-fg-subtle">{r.hint}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <Textarea
                      className="mt-4"
                      rows={3}
                      maxLength={1000}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Anything that helps an admin understand (optional)"
                      aria-label="Details"
                    />
                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void submit()}
                        loading={busy}
                        disabled={!reason}
                      >
                        Send report
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
