"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api/client";
import type { Note } from "@/lib/types";
import { formatDuration, timeAgo } from "@/lib/format";
import { Avatar, Button, Textarea } from "../ui";
import { MessageSquareIcon, ThumbsUpIcon, TrashIcon } from "../ui/icons";
import { useToast } from "../layout/toast";
import { usePlayerSeek } from "../timelapse/player-seek";
import { ReportButton } from "./report-button";
import { DemoNote, DemoTag } from "../demo/tag";

export function DiscussionPanel({
  slug,
  title,
  initialNotes,
  signedIn,
  demo = false,
}: {
  slug: string;
  title: string;

  initialNotes: Note[];

  signedIn: boolean;

  demo?: boolean;
}) {
  const { success, error } = useToast();
  const seek = usePlayerSeek();

  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [timestampInput, setTimestampInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyNote, setBusyNote] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  function parseTimestamp(raw: string): number | null {
    const value = raw.trim();
    if (!value) return null;
    const parts = value.split(":");
    if (parts.length > 3) return null;
    let total = 0;
    for (const part of parts) {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 0) return null;
      total = total * 60 + n;
    }
    return total;
  }

  const timestampValue = parseTimestamp(timestampInput);
  const timestampInvalid = timestampInput.trim() !== "" && timestampValue === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || timestampInvalid) return;

    setPosting(true);
    try {
      const created = await api<Note>(`/v1/timelapses/${slug}/notes`, {
        method: "POST",
        body: {
          body: text,
          ...(timestampValue === null ? {} : { timestampSeconds: timestampValue }),
        },
      });
      setNotes((current) => [created, ...current]);
      setBody("");
      setTimestampInput("");
      success("Your note is on the thread.");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That note could not be posted.");
    } finally {
      setPosting(false);
    }
  }

  async function handleVote(note: Note) {
    setBusyNote(note.id);

    const next = !note.viewerHasVoted;
    setNotes((current) =>
      current.map((n) =>
        n.id === note.id
          ? { ...n, viewerHasVoted: next, helpfulCount: n.helpfulCount + (next ? 1 : -1) }
          : n,
      ),
    );
    try {
      const result = await api<{ helpfulCount: number; viewerHasVoted: boolean }>(
        `/v1/timelapses/${slug}/notes/${note.id}/vote`,
        { method: "POST", body: { helpful: next } },
      );
      setNotes((current) => current.map((n) => (n.id === note.id ? { ...n, ...result } : n)));
    } catch (err) {
      setNotes((current) => current.map((n) => (n.id === note.id ? note : n)));
      error(err instanceof ApiError ? err.message : "That vote did not register.");
    } finally {
      setBusyNote(null);
    }
  }

  async function handleDelete(note: Note) {
    setBusyNote(note.id);
    try {
      await api(`/v1/timelapses/${slug}/notes/${note.id}`, { method: "DELETE" });
      setNotes((current) => current.filter((n) => n.id !== note.id));
      success("Note removed.");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That note could not be removed.");
    } finally {
      setBusyNote(null);
    }
  }

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="notes-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="notes-heading"
          className="flex items-center gap-2 text-[18px] font-semibold tracking-tight"
        >
          <MessageSquareIcon size={18} />
          <span>Peer notes</span>
          <span className="text-[13px] font-normal tabular-nums text-fg-subtle">
            ({notes.length})
          </span>
          {demo ? <DemoTag /> : null}
        </h2>
      </div>

      <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-fg-muted">
        Observations on the implementation, the architecture or a specific moment in{" "}
        <span className="font-medium text-fg">{title}</span>. Click a timestamp to jump the video to
        it.
      </p>

      {demo ? (
        <DemoNote className="mt-5">
          An invented thread, shown so the page is not empty. Nothing here can be posted, voted on
          or deleted.
        </DemoNote>
      ) : signedIn ? (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface p-4"
        >
          <Textarea
            rows={3}
            placeholder="Share an observation on the implementation, architecture or technique…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            aria-label="Your note"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="sm:w-44">
              <label
                htmlFor="note-timestamp"
                className="block text-[12px] font-medium text-fg-muted"
              >
                Timestamp <span className="font-normal text-fg-subtle">(optional)</span>
              </label>
              <input
                id="note-timestamp"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 0:42"
                value={timestampInput}
                onChange={(e) => setTimestampInput(e.target.value)}
                aria-invalid={timestampInvalid || undefined}
                aria-describedby={timestampInvalid ? "note-timestamp-error" : undefined}
                className="mt-1 h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
              />
              {timestampInvalid ? (
                <p id="note-timestamp-error" role="alert" className="mt-1 text-[12px] text-danger">
                  Use seconds, or mm:ss.
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="sm"
              loading={posting}
              disabled={!body.trim() || timestampInvalid}
            >
              Post note
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-5 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface p-4">
          <p className="text-sm text-fg-muted">
            Notes are written by people with an account, so every observation has an author who can
            answer for it.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/watch/${slug}`)}`}
            className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline"
          >
            Get a sign-in link to join the thread
          </Link>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {notes.length === 0 ? (
          <li className="rounded-[var(--radius-card)] border border-dashed border-border-strong py-10 text-center text-sm text-fg-muted">
            No notes yet. Be the first to point something out.
          </li>
        ) : (
          notes.map((note) => (
            <li
              key={note.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors duration-200 hover:border-border-strong"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <Avatar name={note.author.displayName} src={note.author.avatarUrl} size={22} />
                <span className="text-[13px] font-medium text-fg">{note.author.displayName}</span>
                <span className="text-[12px] text-fg-subtle">@{note.author.handle}</span>
                <span aria-hidden className="text-fg-subtle">
                  ·
                </span>
                <time dateTime={note.createdAt} className="text-[12px] text-fg-subtle">
                  {timeAgo(note.createdAt)}
                </time>

                {note.timestampSeconds !== undefined ? (
                  <button
                    type="button"
                    onClick={() => seek?.seek(note.timestampSeconds!)}
                    disabled={!seek}
                    className="press ml-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium text-accent transition-colors duration-200 hover:bg-accent/20 disabled:cursor-default disabled:opacity-60"
                    title={seek ? "Jump the video to this moment" : "This page has no video"}
                  >
                    {formatDuration(note.timestampSeconds)}
                  </button>
                ) : null}

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleVote(note)}
                    disabled={!signedIn || busyNote === note.id}
                    aria-pressed={note.viewerHasVoted}
                    aria-label={
                      note.viewerHasVoted ? "Remove your helpful mark" : "Mark this note helpful"
                    }
                    title={signedIn ? undefined : "Sign in to mark a note helpful"}
                    className={`press flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                      note.viewerHasVoted
                        ? "border-accent/40 bg-accent-soft text-accent"
                        : "border-border bg-surface-raised text-fg-muted hover:text-fg"
                    }`}
                  >
                    <ThumbsUpIcon size={12} />
                    <span className="tabular-nums">{note.helpfulCount}</span>
                  </button>

                  {!note.viewerCanDelete ? (
                    <ReportButton slug={slug} noteId={note.id} signedIn={signedIn} demo={demo} compact />
                  ) : null}
                  {note.viewerCanDelete ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(note)}
                      disabled={busyNote === note.id}
                      aria-label="Delete this note"
                      className="press rounded-full border border-transparent p-1 text-fg-subtle transition-colors duration-200 hover:border-danger/40 hover:text-danger disabled:opacity-60"
                    >
                      <TrashIcon size={13} />
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                {note.body}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
