"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import type { Timelapse, Upload } from "@/lib/types";
import { uploadToStorage } from "@/lib/upload";
import { useToast } from "../layout/toast";
import { Button, Field, Input, Textarea } from "../ui";
import { ExternalIcon, TrashIcon, UploadIcon } from "../ui/icons";

/**
 * The operator's editor for one session.
 *
 * It exists because the creator's own editor refuses to touch a session once it
 * is in review or published — deliberately, so a reviewer is never reading a
 * moving target. That leaves an operator unable to fix a typo or a dead link on
 * live work without unpublishing it and starting again, which is the gap this
 * fills. Every save is written to the audit trail naming the fields it changed,
 * because a change that moves no status is otherwise invisible.
 *
 * Emptying a link field is a real instruction here: it clears the link. A
 * creator editing their own write-up rarely needs that; an operator cleaning up
 * a submission that pointed at somebody else's repository does.
 */
export function TimelapseEditor({
  timelapse,
  onPatch,
  onClose,
}: {
  timelapse: Timelapse;
  onPatch: (patch: Partial<Timelapse>) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: timelapse.title,
    summary: timelapse.summary,
    githubUrl: timelapse.githubUrl ?? "",
    xUrl: timelapse.xUrl ?? "",
    sessionMinutes: String(timelapse.sessionMinutes),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [poster, setPoster] = useState(timelapse.thumbnailUrl ?? "");
  const [posterBusy, setPosterBusy] = useState<"upload" | "clear" | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = await api<Timelapse>(`/v1/admin/timelapses/${timelapse.id}`, {
        method: "PATCH",
        body: {
          title: form.title.trim(),
          summary: form.summary.trim(),
          githubUrl: form.githubUrl.trim(),
          xUrl: form.xUrl.trim(),
          sessionMinutes: Number(form.sessionMinutes),
        },
      });
      onPatch(updated);
      toast.success("Saved. The change is live and on the audit trail.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (Object.keys(err.fields).length === 0) toast.error(err.message);
      } else {
        toast.error("That save did not go through.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function choosePoster(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPosterBusy("upload");
    try {
      // The API issues the destination, so the operator never chooses where an
      // object lands; then the bytes go straight to storage, and only the key
      // comes back.
      const upload = await api<Upload>("/v1/admin/uploads/thumbnail", {
        body: { contentType: file.type, sizeBytes: file.size },
      });
      await uploadToStorage(upload.url, file);
      await api(`/v1/admin/timelapses/${timelapse.id}/thumbnail`, {
        method: "PUT",
        body: { key: upload.key },
      });
      // Read the stored reference back instead of composing a URL: the API is
      // what turns a key into something a browser can load, and how it does that
      // depends on whether the bucket is public.
      const fresh = await api<Timelapse>(`/v1/timelapses/${timelapse.slug}`);
      setPoster(fresh.thumbnailUrl ?? "");
      onPatch({ thumbnailUrl: fresh.thumbnailUrl });
      toast.success("Poster replaced.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That image did not upload.");
    } finally {
      setPosterBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearPoster() {
    setPosterBusy("clear");
    try {
      await api(`/v1/admin/timelapses/${timelapse.id}/thumbnail`, { method: "DELETE" });
      setPoster("");
      onPatch({ thumbnailUrl: undefined });
      toast.success("Poster removed. The session falls back to the generated card.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setPosterBusy(null);
    }
  }

  const minutes = Number(form.sessionMinutes);
  const minutesValid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 10080;

  return (
    <section
      aria-label={`Edit ${timelapse.title}`}
      className="animate-scale-in rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Edit session</h2>
          <p className="mt-1 text-[12.5px] text-fg-subtle">
            {timelapse.creator.displayName} ·{" "}
            {timelapse.publishedAt
              ? `published ${timeAgo(timelapse.publishedAt)}`
              : "not published"}{" "}
            · every change is recorded in the audit trail
          </p>
        </div>
        <span className="flex items-center gap-2">
          <Link
            href={`/watch/${timelapse.slug}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-accent"
          >
            View page
            <ExternalIcon size={12} />
          </Link>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </span>
      </div>

      <form onSubmit={save} className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <Field label="Title" htmlFor="edit-title" error={errors.title}>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
            />
          </Field>

          <Field
            label="Summary"
            htmlFor="edit-summary"
            hint="40 characters minimum. This is the text a visitor reads on the card."
            error={errors.summary}
          >
            <Textarea
              id="edit-summary"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={6}
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="GitHub link"
              htmlFor="edit-github"
              hint="Clear the field to remove the link."
              error={errors.githubUrl}
            >
              <Input
                id="edit-github"
                value={form.githubUrl}
                onChange={(e) => set("githubUrl", e.target.value)}
                placeholder="https://github.com/owner/repo"
                inputMode="url"
              />
            </Field>
            <Field
              label="X link"
              htmlFor="edit-x"
              hint="Clear the field to remove the link."
              error={errors.xUrl}
            >
              <Input
                id="edit-x"
                value={form.xUrl}
                onChange={(e) => set("xUrl", e.target.value)}
                placeholder="https://x.com/handle"
                inputMode="url"
              />
            </Field>
          </div>

          <Field
            label="Session length"
            htmlFor="edit-minutes"
            hint="Minutes of real work the recording covers."
            error={errors.sessionMinutes}
          >
            <Input
              id="edit-minutes"
              type="number"
              min={1}
              max={10080}
              value={form.sessionMinutes}
              onChange={(e) => set("sessionMinutes", e.target.value)}
              className="max-w-40"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" loading={saving} disabled={!minutesValid}>
              Save changes
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium text-fg">Poster</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-subtle">
            The image on every card and share. JPEG, PNG or WebP, up to 8 MB.
          </p>
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface-raised">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center px-3 text-center text-[12px] text-fg-subtle">
                No poster. The card uses a generated pattern.
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={posterBusy === "upload"}
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon size={14} />
              {poster ? "Replace" : "Upload image"}
            </Button>
            {poster ? (
              <Button
                size="sm"
                variant="ghost"
                loading={posterBusy === "clear"}
                onClick={() => void clearPoster()}
              >
                <TrashIcon size={14} />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void choosePoster(e)}
          />
        </div>
      </form>
    </section>
  );
}
