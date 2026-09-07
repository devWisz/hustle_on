"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { UploadIcon, CheckIcon } from "./icons";

interface UploadTarget {
  url: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

type Phase = "details" | "uploading" | "finishing" | "done";

/** Only what the bucket accepts; the API enforces the same list server-side. */
const ACCEPTED = "video/mp4,video/quicktime,video/webm,video/x-matroska";

/** Above this the browser is not asked to hash the file — the pipeline does it. */
const CHECKSUM_LIMIT = 256 * 1024 * 1024;

/**
 * Publishing a session.
 *
 * The file goes from the browser straight to object storage using a URL the
 * API signs, so a large upload never occupies an API process, and the
 * credentials that authorise it never reach this page.
 */
export function UploadForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");

  const [phase, setPhase] = useState<Phase>("details");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!file) {
      setError("Choose the timelapse file to upload.");
      return;
    }

    try {
      setPhase("uploading");
      setProgress(0);

      const target = await api<UploadTarget>("/v1/uploads", {
        body: { contentType: file.type, sizeBytes: file.size },
      });

      await putFile(target.url, file, setProgress);

      setPhase("finishing");
      const { id } = await api<{ id: string }>("/v1/videos", {
        body: {
          storageKey: target.key,
          title: title.trim(),
          description: description.trim(),
          sessionMinutes: Number(sessionMinutes) || 0,
          visibility,
          tags: tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        },
      });

      await api(`/v1/videos/${id}/uploaded`, {
        body: {
          sizeBytes: file.size,
          checksumSha256: file.size <= CHECKSUM_LIMIT ? await sha256Hex(file) : "",
        },
      });

      await api(`/v1/videos/${id}/publish`, { method: "POST" });

      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("details");
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        setError(err.message);
      } else {
        setError("The upload did not complete. Nothing was published.");
      }
    }
  }

  if (phase === "done") {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckIcon size={22} />
        </div>
        <h2 className="mt-4 text-[17px] font-semibold">Session published</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          It is processing now and will appear on your profile and in the feed within a few minutes.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
          <Button
            onClick={() => {
              setFile(null);
              setTitle("");
              setDescription("");
              setSessionMinutes("");
              setTags("");
              setPhase("details");
              setProgress(0);
            }}
          >
            Publish another
          </Button>
        </div>
      </Card>
    );
  }

  const busy = phase === "uploading" || phase === "finishing";

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="p-6">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]
                     border border-dashed border-border-strong bg-surface-raised px-6 py-12
                     transition-colors hover:border-accent disabled:opacity-60"
        >
          <UploadIcon size={26} className="text-fg-subtle" />
          <span className="text-sm font-medium">
            {file ? file.name : "Choose your timelapse file"}
          </span>
          <span className="text-[13px] text-fg-subtle">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
              : "MP4, MOV, WebM or MKV. Up to 2 GB."}
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        {busy ? (
          <div className="mt-5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] text-fg-muted">
              {phase === "uploading" ? `Uploading ${progress}%` : "Finishing up"}
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-5 p-6">
        <Field label="Title" htmlFor="title" error={fieldErrors.title}>
          <Input
            id="title"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write-ahead log, day 14"
          />
        </Field>

        <Field
          label="What you worked on"
          htmlFor="description"
          hint="What you set out to do, and what actually happened."
          error={fieldErrors.description}
        >
          <Textarea
            id="description"
            rows={5}
            maxLength={5000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Session length in minutes"
            htmlFor="sessionMinutes"
            hint="The real time behind the timelapse."
            error={fieldErrors.sessionMinutes}
          >
            <Input
              id="sessionMinutes"
              inputMode="numeric"
              value={sessionMinutes}
              onChange={(event) => setSessionMinutes(event.target.value)}
              placeholder="360"
            />
          </Field>

          <Field label="Visibility" htmlFor="visibility" error={fieldErrors.visibility}>
            <select
              id="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
            >
              <option value="public">Public — in the feed</option>
              <option value="unlisted">Unlisted — anyone with the link</option>
              <option value="private">Private — only you</option>
            </select>
          </Field>
        </div>

        <Field label="Tags" htmlFor="tags" hint="Up to eight, comma separated." error={fieldErrors.tags}>
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="rust, databases"
          />
        </Field>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={busy} disabled={!file || !title.trim()}>
          Publish session
        </Button>
      </div>
    </form>
  );
}

/**
 * Uploads to the presigned URL.
 *
 * XMLHttpRequest rather than fetch: it reports upload progress, which fetch
 * still cannot do, and a two-gigabyte upload with no progress bar is a broken
 * experience.
 */
function putFile(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${request.status}`)),
    );
    request.addEventListener("error", () => reject(new Error("Upload failed")));
    request.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    request.send(file);
  });
}

/** Hex SHA-256 of a file, so the API can detect a corrupted upload. */
async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
