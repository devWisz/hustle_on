"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { formatSession, timeAgo } from "@/lib/format";
import type { Timelapse } from "@/lib/types";
import { Avatar, Button, Card, Field, Textarea } from "./ui";
import { useToast } from "./toast";
import { GitHubIcon, XIcon } from "./icons";

/**
 * The review queue.
 *
 * A reviewer sees the video, the write-up and the links side by side, because
 * the decision is whether those three describe the same piece of work. Nothing
 * here is a bulk action: approving in one click across a list is how unchecked
 * submissions reach a feed.
 */
export function ReviewQueue({ initial }: { initial: Timelapse[] }) {
  const [queue, setQueue] = useState(initial);

  function remove(id: string) {
    setQueue((current) => current.filter((t) => t.id !== id));
  }

  if (queue.length === 0) {
    return (
      <Card className="p-10 text-center">
        <h2 className="text-[15px] font-medium">The queue is empty</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          Every submission has been decided. New ones appear here as they arrive.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-6">
      {queue.map((t) => (
        <li key={t.id}>
          <ReviewItem timelapse={t} onDecided={() => remove(t.id)} />
        </li>
      ))}
    </ul>
  );
}

function ReviewItem({ timelapse, onDecided }: { timelapse: Timelapse; onDecided: () => void }) {
  const router = useRouter();
  const toast = useToast();

  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    try {
      await api(`/v1/admin/timelapses/${timelapse.id}/${action}`, {
        method: "POST",
        body: action === "reject" ? { note: note.trim() } : undefined,
      });
      toast.success(action === "approve" ? "Published." : "Sent back to the creator.");
      onDecided();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That decision did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          {timelapse.playbackUrl ? (
            <video
              controls
              preload="metadata"
              playsInline
              poster={timelapse.thumbnailUrl}
              className="aspect-video w-full rounded-[var(--radius-control)] bg-black"
            >
              <source src={timelapse.playbackUrl} />
            </video>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface-raised text-[13px] text-fg-muted">
              No video attached
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
            <Avatar
              name={timelapse.creator.displayName}
              src={timelapse.creator.avatarUrl}
              size={22}
            />
            {timelapse.creator.displayName}
            <span aria-hidden className="text-fg-subtle">
              ·
            </span>
            @{timelapse.creator.handle}
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug">{timelapse.title}</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {timelapse.sessionMinutes > 0 ? `${formatSession(timelapse.sessionMinutes)} · ` : ""}
            submitted {timelapse.submittedAt ? timeAgo(timelapse.submittedAt) : "recently"}
          </p>

          <div className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-fg">
            {timelapse.summary}
          </div>

          {timelapse.githubUrl || timelapse.xUrl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {timelapse.githubUrl ? (
                <SourceLink href={timelapse.githubUrl} icon={<GitHubIcon size={14} />} />
              ) : null}
              {timelapse.xUrl ? (
                <SourceLink href={timelapse.xUrl} icon={<XIcon size={13} />} />
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-fg-subtle">No links supplied.</p>
          )}

          {rejecting ? (
            <div className="mt-5 space-y-3">
              <Field
                label="Why this is being sent back"
                htmlFor={`note-${timelapse.id}`}
                hint="The creator reads this on their dashboard, so make it something they can act on."
              >
                <Textarea
                  id={`note-${timelapse.id}`}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  autoFocus
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={note.trim().length < 10}
                  onClick={() => decide("reject")}
                >
                  Send back
                </Button>
                <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex gap-2">
              <Button loading={busy} onClick={() => decide("approve")}>
                Approve and publish
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                Send back
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function SourceLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-control)] border border-border px-2.5 text-[12px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      {icon}
      <span className="max-w-[26ch] truncate">{href.replace(/^https:\/\/(www\.)?/, "")}</span>
    </a>
  );
}
