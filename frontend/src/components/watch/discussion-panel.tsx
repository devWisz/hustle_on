"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api/client";
import { fetchTimelapseNotes } from "@/lib/pagination";
import type { Note } from "@/lib/types";
import { cx, formatDuration, timeAgo } from "@/lib/format";
import { Avatar, Button, PagedList, Textarea, buttonClass } from "../ui";
import { MessageSquareIcon, ThumbsUpIcon, TrashIcon } from "../ui/icons";
import { useToast } from "../layout/toast";
import { usePlayerSeek } from "../timelapse/player-seek";
import { ReportButton } from "./report-button";

const voteBase =
  "press flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200";

export function DiscussionPanel({
  slug,
  initialNotes,
  nextCursor,
  signedIn,
}: {
  slug: string;
  initialNotes: Note[];
  nextCursor?: string;
  signedIn: boolean;
}) {
  const { success, error } = useToast();
  const seek = usePlayerSeek();
  const signInHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;

  const [body, setBody] = useState("");
  const [timestampInput, setTimestampInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyNote, setBusyNote] = useState<string | null>(null);
  /**
   * Later pages arrive in the browser while a note is being posted, voted on or
   * removed, so this component does not own the list: each action records its
   * effect here and the list merges it over whatever the pager holds.
   */
  const [posted, setPosted] = useState<Note[]>([]);
  const [votes, setVotes] = useState<
    Record<string, { helpfulCount: number; viewerHasVoted: boolean }>
  >({});
  const [removed, setRemoved] = useState<string[]>([]);

  function merge(all: Note[]): Note[] {
    const seen = new Set(posted.map((n) => n.id));
    return [...posted, ...all.filter((n) => !seen.has(n.id))]
      .filter((n) => !removed.includes(n.id))
      .map((n) => {
        const vote = votes[n.id];
        return vote ? { ...n, ...vote } : n;
      });
  }

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
    if (!signedIn) return;
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
      setPosted((current) => [created, ...current]);
      setBody("");
      setTimestampInput("");
      success("Note posted.");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That note could not be posted.");
    } finally {
      setPosting(false);
    }
  }

  async function handleVote(note: Note) {
    if (!signedIn) return;
    setBusyNote(note.id);

    const next = !note.viewerHasVoted;
    const optimistic = {
      viewerHasVoted: next,
      helpfulCount: note.helpfulCount + (next ? 1 : -1),
    };
    setVotes((current) => ({ ...current, [note.id]: optimistic }));
    try {
      const result = await api<{ helpfulCount: number; viewerHasVoted: boolean }>(
        `/v1/timelapses/${slug}/notes/${note.id}/vote`,
        { method: "POST", body: { helpful: next } },
      );
      setVotes((current) => ({ ...current, [note.id]: result }));
    } catch (err) {
      setVotes((current) => ({
        ...current,
        [note.id]: {
          helpfulCount: note.helpfulCount,
          viewerHasVoted: note.viewerHasVoted,
        },
      }));
      error(err instanceof ApiError ? err.message : "That vote did not register.");
    } finally {
      setBusyNote(null);
    }
  }

  async function handleDelete(note: Note) {
    setBusyNote(note.id);
    try {
      await api(`/v1/timelapses/${slug}/notes/${note.id}`, { method: "DELETE" });
      setRemoved((current) => [...current, note.id]);
      success("Note removed.");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That note could not be removed.");
    } finally {
      setBusyNote(null);
    }
  }

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="notes-heading">
      <PagedList
        initial={initialNotes}
        initialCursor={nextCursor}
        load={(cursor) => fetchTimelapseNotes(slug, cursor)}
        label="Load more notes"
        errorText="More notes could not be loaded. Try again."
        className="mt-6 flex flex-col items-center gap-3"
        render={(all) => {
          const notes = merge(all);

          return (
            <>
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
                </h2>
              </div>

              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-fg-muted">
                What stood out: a technique, a decision, a moment. Click a timestamp to jump to it.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface p-4"
              >
                <Textarea
                  rows={3}
                  placeholder="What stood out?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  aria-label="Note"
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
                      <p
                        id="note-timestamp-error"
                        role="alert"
                        className="mt-1 text-[12px] text-danger"
                      >
                        Use seconds, or mm:ss.
                      </p>
                    ) : null}
                  </div>

                  {signedIn ? (
                    <Button
                      type="submit"
                      size="sm"
                      loading={posting}
                      disabled={!body.trim() || timestampInvalid}
                    >
                      Post note
                    </Button>
                  ) : (
                    <Link href={signInHref} className={buttonClass("primary", "sm")}>
                      Sign in to post
                    </Link>
                  )}
                </div>
              </form>

              <ul className="mt-6 space-y-3">
                {notes.length === 0 ? (
                  <li className="rounded-[var(--radius-card)] border border-dashed border-border-strong py-10 text-center text-sm text-fg-muted">
                    No notes yet. Be the first.
                  </li>
                ) : (
                  notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors duration-200 hover:border-border-strong"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <Avatar
                          name={note.author.displayName}
                          src={note.author.avatarUrl}
                          size={22}
                        />
                        <span className="text-[13px] font-medium text-fg">
                          {note.author.displayName}
                        </span>
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
                          {signedIn ? (
                            <button
                              type="button"
                              onClick={() => handleVote(note)}
                              disabled={busyNote === note.id}
                              aria-pressed={note.viewerHasVoted}
                              aria-label={
                                note.viewerHasVoted
                                  ? "Remove your helpful mark"
                                  : "Mark this note helpful"
                              }
                              className={cx(
                                voteBase,
                                "disabled:cursor-not-allowed disabled:opacity-60",
                                note.viewerHasVoted
                                  ? "border-accent/40 bg-accent-soft text-accent"
                                  : "border-border bg-surface-raised text-fg-muted hover:text-fg",
                              )}
                            >
                              <ThumbsUpIcon size={12} />
                              <span className="tabular-nums">{note.helpfulCount}</span>
                            </button>
                          ) : (
                            <Link
                              href={signInHref}
                              aria-label="Sign in to mark this note helpful"
                              className={cx(
                                voteBase,
                                "border-border bg-surface-raised text-fg-muted hover:text-fg",
                              )}
                            >
                              <ThumbsUpIcon size={12} />
                              <span className="tabular-nums">{note.helpfulCount}</span>
                            </Link>
                          )}

                          {!note.viewerCanDelete ? (
                            <ReportButton slug={slug} noteId={note.id} signedIn={signedIn} compact />
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
            </>
          );
        }}
      />
    </section>
  );
}
