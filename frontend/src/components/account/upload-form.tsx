"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api/client";
import { uploadToStorage } from "@/lib/upload";
import { cx, formatDuration } from "@/lib/format";
import {
  ACCEPT_VIDEO_ATTR,
  MAX_SESSION_MINUTES,
  MAX_SUMMARY,
  MAX_TITLE,
  MIN_SESSION_MINUTES,
  MIN_SUMMARY,
  MIN_TITLE,
  acceptedTypesLabel,
  cleanNumber,
  durationToMinutes,
  fileProblem,
  formatBytes,
} from "@/lib/timelapse-upload";
import type { Timelapse, Upload } from "@/lib/types";
import { Button, ButtonLink, Card, Field, Input, Textarea } from "../ui";
import { AlertIcon, ArrowRightIcon, CheckIcon, UploadIcon } from "../ui/icons";

/**
 * Which part of the request is in flight.
 *
 * `authoring` asks the API where the bytes should go, `bytes` sends them to
 * storage, and the last two record what arrived and ask for a review. Retrying
 * needs those apart: an earlier stage that succeeded must not run again, and a
 * re-run has to look different from a first attempt in a couple of places.
 */
type Stage = "idle" | "authoring" | "bytes" | "metadata" | "submitting" | "done";

/**
 * The progress indicator names the same steps the form does, so a slow upload
 * does not read as a different process from the one being filled in.
 */
const STAGE_LABELS: Record<Exclude<Stage, "idle">, string> = {
  authoring: "Step 1 of 3 · Uploading the file",
  bytes: "Step 1 of 3 · Uploading the file",
  metadata: "Step 2 of 3 · Saving what you wrote",
  submitting: "Step 3 of 3 · Sending it to review",
  done: "Step 3 of 3 · Sent to review",
};

const STILL_HERE = "Your write-up and the file are still here. Try again.";

export function UploadForm() {
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [xUrl, setXUrl] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [attested, setAttested] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // What a previous attempt already achieved. Both outlive a failure on purpose:
  // asking for a destination or creating a draft twice is work the API does not
  // need to repeat, and the write-up never has to be typed again.
  const uploadRef = useRef<Upload | null>(null);
  const keyRef = useRef<string | null>(null);
  const createdRef = useRef<string | null>(null);
  // A typed session length outranks a detected one, and detection arrives late.
  const editedSession = useRef(false);

  const busy = stage !== "idle" && stage !== "done";
  const done = stage === "done";
  // The write-up being complete is what makes the review controls worth
  // attention; the attestation stays in that step rather than gating it, so the
  // checkbox is reachable at the moment it is needed.
  const writeUpReady =
    title.trim().length >= MIN_TITLE &&
    summary.trim().length >= MIN_SUMMARY &&
    summary.trim().length <= MAX_SUMMARY;
  const step = !file || busy || done ? 1 : writeUpReady ? 3 : 2;
  const stepOne = step === 1;
  const stepTwo = step === 2;

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pickFile(chosen: File | null) {
    setFileError("");
    setReviewError("");
    setFieldErrors({});
    if (!chosen) return;

    const problem = fileProblem(chosen);
    if (problem) {
      setFileError(problem);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    // A different file needs a different destination: a URL signed for the
    // previous bytes is not valid for these, so nothing may be carried over.
    uploadRef.current = null;
    keyRef.current = null;
    createdRef.current = null;
    setFile(chosen);
    setDuration(0);

    const seconds = await readDuration(chosen);
    setDuration(seconds);
    if (seconds > 0 && !editedSession.current) {
      setSessionMinutes(String(durationToMinutes(seconds)));
    }
  }

  function validate(): boolean {
    const problems: Record<string, string> = {};
    const trimmedTitle = title.trim();
    const summaryLength = summary.trim().length;
    const minutes = Number(sessionMinutes);

    if (trimmedTitle.length < MIN_TITLE) {
      problems.title = `Give it a title of at least ${MIN_TITLE} characters.`;
    } else if (trimmedTitle.length > MAX_TITLE) {
      problems.title = `Titles stop at ${MAX_TITLE} characters.`;
    }
    if (summaryLength < MIN_SUMMARY) {
      problems.summary = `The write-up is ${summaryLength} of ${MIN_SUMMARY} characters. Say what you were trying to do and what happened.`;
    } else if (summaryLength > MAX_SUMMARY) {
      problems.summary = `The write-up stops at ${MAX_SUMMARY} characters.`;
    }
    if (!sessionMinutes.trim()) {
      problems.sessionMinutes = "Enter how long the session took.";
    } else if (!Number.isInteger(minutes)) {
      problems.sessionMinutes = "Whole minutes only.";
    } else if (minutes < MIN_SESSION_MINUTES || minutes > MAX_SESSION_MINUTES) {
      problems.sessionMinutes = `Between ${MIN_SESSION_MINUTES} and ${MAX_SESSION_MINUTES} minutes.`;
    }
    if (!attested) {
      problems.attested = "Confirm the work is yours before sending it.";
    }

    setFieldErrors(problems);
    return Object.keys(problems).length === 0;
  }

  /**
   * Runs the remaining work, skipping whatever already succeeded.
   *
   * Each stage records its result before the next begins, so a failure halfway
   * leaves the earlier ones done. A retry from storage back is a different shape
   * of attempt from a first one, which is why it says so in the copy.
   */
  async function resume(file: File, durationSeconds: number) {
    const minutes = Math.round(Number(sessionMinutes));

    try {
      setFileError("");
      setReviewError("");

      if (stage === "idle" || stage === "authoring") {
        setStage("authoring");
        setProgress(0);
        const upload = await api<Upload>("/v1/uploads", {
          body: { contentType: file.type, sizeBytes: file.size },
        });
        uploadRef.current = upload;
        keyRef.current = upload.key;
      }

      const signed = uploadRef.current;
      if (signed) {
        setStage("bytes");
        await uploadToStorage(signed.url, file, setProgress);
        // Storage has the bytes now, so the signature will never be needed
        // again — and would be stale if it were.
        uploadRef.current = null;
      }

      if (!createdRef.current) {
        setStage("metadata");
        const storageKey = keyRef.current;
        if (!storageKey) throw new Error("The upload address was lost.");
        const created = await api<Timelapse>("/v1/timelapses", {
          body: {
            title: title.trim(),
            summary: summary.trim(),
            githubUrl: githubUrl.trim(),
            xUrl: xUrl.trim(),
            storageKey,
            sessionMinutes: minutes,
          },
        });
        createdRef.current = created.id;
        await api(`/v1/timelapses/${created.id}/uploaded`, {
          body: { sizeBytes: file.size, durationSeconds: Math.round(durationSeconds) },
        });
      }

      const id = createdRef.current;
      if (!id) throw new Error("The submission reference was lost.");
      setStage("submitting");
      await api(`/v1/timelapses/${id}/submit`, { method: "POST" });

      setStage("done");
      setProgress(0);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      // Anything signed for these bytes before the failure is either spent or
      // expired, so the next attempt asks for a fresh destination. The draft, if
      // it was created, is the part worth keeping.
      uploadRef.current = null;
      setStage("idle");
      setProgress(0);
      const message = err instanceof Error && err.message ? err.message : "The upload stopped.";
      if (stage === "metadata" || stage === "submitting") setReviewError(message);
      else setFileError(`${message} ${STILL_HERE}`);
      if (err instanceof ApiError) setFieldErrors(err.fields);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFileError("");
    setReviewError("");

    if (!file) {
      setFileError("Choose a video file before sending it for review.");
      return;
    }
    const problem = fileProblem(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    if (!validate()) return;

    void resume(file, duration);
  }

  /** Back to an empty sequence, for an operator with a second recording. */
  function startOver() {
    setFile(null);
    setDuration(0);
    setTitle("");
    setSummary("");
    setSessionMinutes("");
    setGithubUrl("");
    setXUrl("");
    setAttested(false);
    setStage("idle");
    setProgress(0);
    setFileError("");
    setReviewError("");
    setFieldErrors({});
    uploadRef.current = null;
    keyRef.current = null;
    createdRef.current = null;
    editedSession.current = false;
    fileInput.current?.focus();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {busy ? (
        <div aria-live="polite" className="sticky top-4 z-10">
          <ProgressBar value={progress} label={STAGE_LABELS[stage]} />
        </div>
      ) : null}

      <Card className={cx("p-5 sm:p-6", stepOne && "ring-1 ring-accent/20")}>
        <Step
          n={1}
          title="Choose the recording"
          description="Drag it in, or open the picker. It goes straight to storage, so keep this tab open until it lands."
          active={stepOne}
        />
        <div className="relative mt-5">
          <input
            ref={fileInput}
            id="file"
            type="file"
            accept={ACCEPT_VIDEO_ATTR}
            aria-label="Choose a timelapse video file"
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
            className="peer sr-only"
          />
          <label
            htmlFor="file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center",
              "transition-[border-color,background-color,box-shadow] duration-200",
              "peer-focus-visible:border-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/25",
              dragging
                ? "border-accent bg-accent-soft"
                : "border-border-strong hover:border-fg-subtle hover:bg-surface-raised",
              busy && "pointer-events-none cursor-not-allowed opacity-60",
            )}
          >
            {previewUrl ? (
              <video
                src={previewUrl}
                muted
                playsInline
                autoPlay
                loop
                className="aspect-video w-full max-w-md rounded-[var(--radius-control)] bg-black object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-fg-muted">
                <UploadIcon size={20} />
              </span>
            )}
            <span className="text-[15px] font-medium">
              {dragging ? "Drop it here" : file ? file.name : "Drag a video here, or choose a file"}
            </span>
            <span className="text-[13px] text-fg-subtle">
              {file
                ? `${formatBytes(file.size)}${
                    duration > 0 ? ` · ${formatDuration(duration)} long` : ""
                  } · choose a different file`
                : `${acceptedTypesLabel()}. Up to 2 GiB.`}
            </span>
          </label>
        </div>

        {duration > 0 ? (
          <p className="mt-3 text-[13px] tabular-nums text-fg-muted">
            The clip is {formatDuration(duration)} long. Step 2 asks how long the work took, which is
            usually longer.
          </p>
        ) : file ? (
          <p className="mt-3 text-[13px] text-fg-subtle">
            Reading the clip&rsquo;s length. Step 2 works either way.
          </p>
        ) : null}

        {fileError || fieldErrors.contentType || fieldErrors.sizeBytes ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-danger"
          >
            <AlertIcon size={15} className="mt-0.5 shrink-0" />
            <span>{fileError || fieldErrors.contentType || fieldErrors.sizeBytes}</span>
          </p>
        ) : null}

        {fileError && file ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void resume(file, duration)}
          >
            Retry the upload
          </Button>
        ) : null}
      </Card>

      <Card className={cx("p-5 sm:p-6", step === 2 && "ring-1 ring-accent/20")}>
        <Step
          n={2}
          title="Say what you did"
          description="A reviewer reads this, not the video. What you were trying to do, what went wrong, what came out of it."
          active={step === 2}
        />
        <div className="mt-6 space-y-6">
          <Field label="Title" htmlFor="title" error={fieldErrors.title}>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="Building a walnut side table from rough boards"
              disabled={!stepTwo}
              required
            />
          </Field>

          <Field
            label="What you did"
            htmlFor="summary"
            hint="The part a viewer cannot get from watching. What you were trying to do, what went wrong, what you ended up with."
            error={fieldErrors.summary}
          >
            <Textarea
              id="summary"
              rows={8}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={MAX_SUMMARY}
              disabled={!stepTwo}
              required
            />
            <p className="mt-1.5 text-right text-[12px] tabular-nums text-fg-subtle">
              {summary.trim().length < MIN_SUMMARY
                ? `${MIN_SUMMARY - summary.trim().length} more characters needed`
                : `${summary.trim().length} / ${MAX_SUMMARY}`}
            </p>
          </Field>

          <Field
            label="Session length in minutes"
            htmlFor="sessionMinutes"
            hint="How long the work took from start to finish — not the length of the clip, which is what the video shows."
            error={fieldErrors.sessionMinutes}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="sessionMinutes"
                type="number"
                min={MIN_SESSION_MINUTES}
                max={MAX_SESSION_MINUTES}
                step="1"
                inputMode="numeric"
                value={sessionMinutes}
                onChange={(e) => {
                  editedSession.current = true;
                  setSessionMinutes(cleanNumber(e.target.value));
                }}
                className="max-w-40 tabular-nums"
                disabled={!stepTwo}
                required
              />
              {duration > 0 ? (
                <span className="text-[13px] tabular-nums text-fg-muted">
                  The clip is {formatDuration(duration)}, so the session was at least{" "}
                  {durationToMinutes(duration)} min. Change it to the real figure.
                </span>
              ) : null}
            </div>
          </Field>
        </div>
      </Card>

      <Card className={cx("p-5 sm:p-6", step === 3 && "ring-1 ring-accent/20")}>
        <Step
          n={3}
          title="Send it for review"
          description="A person reads every submission. Links are optional, but they are what let them check the work rather than take your word for it."
          active={step === 3}
        />
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="GitHub URL"
              htmlFor="githubUrl"
              hint="Optional. You can add it later from the dashboard."
              error={fieldErrors.githubUrl}
            >
              <Input
                id="githubUrl"
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/you/project"
                disabled={!stepTwo}
              />
            </Field>
            <Field
              label="X URL"
              htmlFor="xUrl"
              hint="Optional. You can add it later from the dashboard."
              error={fieldErrors.xUrl}
            >
              <Input
                id="xUrl"
                type="url"
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/you"
                disabled={!stepTwo}
              />
            </Field>
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 text-[13.5px] leading-relaxed text-fg-muted">
              <input
                type="checkbox"
                checked={attested}
                disabled={!stepTwo}
                onChange={(e) => setAttested(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                This is my own work and I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-fg underline underline-offset-2"
                >
                  Terms and Conditions
                </Link>
                .
              </span>
            </label>
            {fieldErrors.attested ? (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {fieldErrors.attested}
              </p>
            ) : null}
          </div>

          {reviewError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-control)] border border-danger/20 bg-danger-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-fg"
            >
              <AlertIcon size={15} className="mt-0.5 shrink-0 text-danger" />
              <span>
                {reviewError} {STILL_HERE}
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            {done ? null : reviewError ? (
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  if (file) void resume(file, duration);
                }}
              >
                Try again
              </Button>
            ) : (
              <Button type="submit" size="lg" loading={busy} disabled={!file}>
                Send for review
              </Button>
            )}
            <p className="text-[13px] text-fg-muted">
              It goes to review first. Nothing is public until a person has read it.
            </p>
          </div>
        </div>
      </Card>

      {done ? <SuccessCard onStartOver={startOver} /> : null}
    </form>
  );
}

function Step({
  n,
  title,
  description,
  active,
}: {
  n: number;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-3 text-[16px] font-semibold">
        <span
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px]",
            active ? "bg-inverse text-inverse-fg" : "bg-surface-raised text-fg-muted",
          )}
        >
          {n}
        </span>
        {title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{description}</p>
    </div>
  );
}

/**
 * The end of the sequence, said plainly.
 *
 * A submission that is waiting on one person is exactly where an operator starts
 * wondering whether it went anywhere, so this states what happens next, what a
 * rejection means, and where to watch for it — without promising a time.
 */
function SuccessCard({ onStartOver }: { onStartOver: () => void }) {
  return (
    <Card role="status" className="border-success/30 bg-success-soft p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-[16px] font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white">
          <CheckIcon size={15} />
        </span>
        It is in review
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">
        A person will read your write-up and watch the recording. Nothing is public until they have.
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">
        If it is not accepted, the note tells you what to change and you can edit and resubmit from
        your dashboard.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href="/dashboard">
          Go to your dashboard
          <ArrowRightIcon size={14} />
        </ButtonLink>
        <Button type="button" variant="secondary" onClick={onStartOver}>
          Upload another
        </Button>
      </div>
    </Card>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="font-mono text-[12px] tabular-nums text-fg-subtle">{Math.round(value)}%</p>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div
          className="h-full bg-accent transition-[width] duration-200"
          // A hair of width at 0% shows the bar is there and moving, rather than
          // an empty track that reads as a stalled upload.
          style={{ width: `${Math.max(value, 2)}%` }}
        />
      </div>
    </div>
  );
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}
