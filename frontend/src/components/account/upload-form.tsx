"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api/client";
import { cx, formatDuration } from "@/lib/format";
import type { Timelapse, Upload } from "@/lib/types";
import { Button, Card, Field, Input, Textarea } from "../ui";
import { UploadIcon } from "../ui/icons";

const MIN_SUMMARY = 40;

type Stage = "idle" | "uploading" | "recording" | "submitting" | "done";

export function UploadForm({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
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
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const busy = stage !== "idle" && stage !== "done";

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
    setFile(chosen);
    setDuration(0);
    if (chosen) setDuration(await readDuration(chosen));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (preview) {
      setError(
        "This is the demo, so nothing was sent. Sign in and the same form submits for real.",
      );
      return;
    }

    if (!file) {
      setError("Choose a video file to upload.");
      return;
    }
    const minutes = Number(sessionMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setFieldErrors({ sessionMinutes: "Enter how long the session actually took." });
      return;
    }

    try {

      setStage("uploading");
      setProgress(0);
      const upload = await api<Upload>("/v1/uploads", {
        body: { contentType: file.type, sizeBytes: file.size },
      });

      await putFile(upload.url, file, setProgress);

      setStage("recording");
      const created = await api<Timelapse>("/v1/timelapses", {
        body: {
          title: title.trim(),
          summary: summary.trim(),
          githubUrl: githubUrl.trim(),
          xUrl: xUrl.trim(),
          storageKey: upload.key,
          sessionMinutes: Math.round(minutes),
        },
      });
      await api(`/v1/timelapses/${created.id}/uploaded`, {
        body: { sizeBytes: file.size, durationSeconds: Math.round(duration) },
      });

      setStage("submitting");
      await api(`/v1/timelapses/${created.id}/submit`, { method: "POST" });

      setStage("done");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setStage("idle");
      setProgress(0);
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(Object.keys(err.fields).length ? "" : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      }
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card className="p-5 sm:p-6">
        <Step n={1} title="The recording" />
        <input
          ref={fileInput}
          id="file"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
          className="sr-only"
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
            const dropped = e.dataTransfer.files?.[0];
            if (dropped && dropped.type.startsWith("video/")) void pickFile(dropped);
          }}
          className={cx(
            "mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-border-strong hover:border-fg-subtle hover:bg-surface-raised",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {previewUrl ? (
            <video src={previewUrl} muted playsInline autoPlay loop className="aspect-video w-full max-w-md rounded-[var(--radius-control)] bg-black object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-fg-muted">
              <UploadIcon size={20} />
            </span>
          )}
          <span className="text-[15px] font-medium">
            {file ? file.name : "Drop your timelapse here, or choose a file"}
          </span>
          <span className="text-[13px] text-fg-subtle">
            {file
              ? `${(file.size / 1_048_576).toFixed(1)} MB${duration > 0 ? ` · ${formatDuration(duration)}` : ""} · click to replace`
              : "MP4, MOV, WebM or MKV. Uploads straight to storage."}
          </span>
        </label>
        {fieldErrors.contentType ?? fieldErrors.sizeBytes ? (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {fieldErrors.contentType ?? fieldErrors.sizeBytes}
          </p>
        ) : null}
        {stage === "uploading" ? <ProgressBar value={progress} /> : null}
      </Card>

      <Card className="space-y-6 p-5 sm:p-6">
        <Step n={2} title="The write-up" />
        <Field label="Title" htmlFor="title" error={fieldErrors.title}>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Rewriting the borrow-checker pass"
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
            maxLength={4000}
            required
          />
          <p className="mt-1.5 text-right text-[12px] tabular-nums text-fg-subtle">
            {summary.trim().length < MIN_SUMMARY
              ? `${MIN_SUMMARY - summary.trim().length} more characters needed`
              : `${summary.trim().length} / 4000`}
          </p>
        </Field>

        <Field
          label="Session length in minutes"
          htmlFor="sessionMinutes"
          hint="How long the work actually took, not the length of the clip."
          error={fieldErrors.sessionMinutes}
        >
          <Input
            id="sessionMinutes"
            type="number"
            min="1"
            max="10080"
            inputMode="numeric"
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(e.target.value)}
            className="max-w-40 tabular-nums"
            required
          />
        </Field>
      </Card>

      <Card className="space-y-6 p-5 sm:p-6">
        <div>
          <Step n={3} title="Where the work lives" />
          <p className="mt-2 text-[13px] text-fg-muted">
            Both optional, but they are what let someone check the work rather than take your word
            for it.
          </p>
        </div>
        <Field label="GitHub URL" htmlFor="githubUrl" error={fieldErrors.githubUrl}>
          <Input
            id="githubUrl"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/you/project"
          />
        </Field>
        <Field label="X URL" htmlFor="xUrl" error={fieldErrors.xUrl}>
          <Input
            id="xUrl"
            type="url"
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            placeholder="https://x.com/you"
          />
        </Field>
      </Card>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={busy}>
          {preview ? "Submit for review" : stageLabel(stage)}
        </Button>
        <p className="text-[13px] text-fg-muted">
          {preview
            ? "Needs an account — a submission has to belong to somebody."
            : "Goes to review first. You will see the decision on your dashboard."}
        </p>
      </div>
    </form>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-[16px] font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-inverse font-mono text-[12px] text-inverse-fg">
        {n}
      </span>
      {title}
    </h2>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case "uploading":
      return "Uploading video…";
    case "recording":
      return "Saving details…";
    case "submitting":
      return "Sending to review…";
    default:
      return "Submit for review";
  }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
      >
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[12px] tabular-nums text-fg-subtle">
        {Math.round(value)}%
      </p>
    </div>
  );
}

function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${request.status}.`));
    request.onerror = () => reject(new Error("The upload could not reach storage."));
    request.send(file);
  });
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
