"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";
import { Avatar, Button, Card, Textarea } from "./ui";
import { MessageSquareIcon, ThumbsUpIcon } from "./icons";
import { useToast } from "./toast";

export interface Note {
  id: string;
  author: string;
  handle?: string;
  avatarUrl?: string;
  timestampSeconds?: number;
  body: string;
  helpfulCount: number;
  createdAt: string;
}

const DEFAULT_NOTES: Record<string, Note[]> = {
  "rewriting-the-borrow-checker-pass": [
    {
      id: "note-1",
      author: "Alex Rivers",
      handle: "arivers",
      timestampSeconds: 38,
      body: "The fixpoint algorithm over the dominator tree completely eliminates the nested loop miscompilation. Clean separation of back-edges.",
      helpfulCount: 14,
      createdAt: "2026-09-19T14:20:00Z",
    },
    {
      id: "note-2",
      author: "Elena Rostova",
      handle: "elena_dev",
      timestampSeconds: 15,
      body: "Notice how the region inference pass was walking the CFG twice before — rewrites like this are why session timelapses are so valuable to study.",
      helpfulCount: 9,
      createdAt: "2026-09-20T08:12:00Z",
    },
  ],
  "oscillator-bank-from-scratch": [
    {
      id: "note-3",
      author: "Marcus Chen",
      handle: "mchen_audio",
      timestampSeconds: 28,
      body: "That wavetable index off-by-one was so subtle. Caught it right when the harmonic spectrum analyzer showed high frequency aliasing foldback.",
      helpfulCount: 12,
      createdAt: "2026-09-20T11:45:00Z",
    },
  ],
};

export function DiscussionPanel({
  slug,
  title,
  onSeekTimestamp,
}: {
  slug: string;
  title: string;
  onSeekTimestamp?: (seconds: number) => void;
}) {
  const { success } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [timestampInput, setTimestampInput] = useState("");
  const [upvoted, setUpvoted] = useState<Record<string, boolean>>({});

  const storageKey = `sardhana-notes-${slug}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setNotes(JSON.parse(stored));
      } else {
        const defaults = DEFAULT_NOTES[slug] ?? [];
        setNotes(defaults);
      }
    } catch {
      setNotes(DEFAULT_NOTES[slug] ?? []);
    }
  }, [slug, storageKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    let timestamp: number | undefined;
    if (timestampInput.trim()) {
      const parts = timestampInput.trim().split(":");
      if (parts.length === 2) {
        const m = parseInt(parts[0] || "0", 10);
        const s = parseInt(parts[1] || "0", 10);
        if (!isNaN(m) && !isNaN(s)) timestamp = m * 60 + s;
      } else {
        const s = parseInt(timestampInput.trim(), 10);
        if (!isNaN(s)) timestamp = s;
      }
    }

    const newNote: Note = {
      id: `note-${Date.now()}`,
      author: authorName.trim() || "Anonymous Peer",
      handle: authorName.trim().toLowerCase().replace(/\s+/g, "_") || "peer",
      timestampSeconds: timestamp,
      body: text,
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
    };

    const updated = [newNote, ...notes];
    setNotes(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setBody("");
    setTimestampInput("");
    success("Your technical note has been posted.");
  }

  function handleUpvote(noteId: string) {
    if (upvoted[noteId]) return;

    const updated = notes.map((n) => {
      if (n.id === noteId) {
        return { ...n, helpfulCount: n.helpfulCount + 1 };
      }
      return n;
    });

    setNotes(updated);
    setUpvoted((prev) => ({ ...prev, [noteId]: true }));
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
          <MessageSquareIcon size={18} />
          <span>Peer Review &amp; Technical Notes</span>
          <span className="text-[13px] font-normal text-fg-subtle tabular-nums">
            ({notes.length})
          </span>
        </h2>
      </div>

      <p className="mt-1 text-[13px] text-fg-muted">
        Discuss the engineering decisions, catch subtle bugs, or leave technical observations on{" "}
        <span className="font-medium text-fg">{title}</span>.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-5 rounded-lg border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <input
            type="text"
            placeholder="Your name or handle (optional)"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-border-strong"
          />
          <input
            type="text"
            placeholder="Timestamp (e.g. 0:42)"
            value={timestampInput}
            onChange={(e) => setTimestampInput(e.target.value)}
            className="rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 py-1.5 text-sm font-mono text-fg placeholder:text-fg-subtle outline-none focus:border-border-strong"
          />
        </div>

        <Textarea
          rows={3}
          placeholder="Share an observation on the implementation, architecture, or technique..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-3 w-full"
        />

        <div className="mt-3 flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim()}>
            Post note
          </Button>
        </div>
      </form>

      {/* Notes List */}
      <div className="mt-6 space-y-4">
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-fg-muted">
            No notes yet. Be the first to share an observation on this session.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={note.author} size={22} />
                  <span className="text-[13px] font-medium text-fg">{note.author}</span>
                  {note.timestampSeconds !== undefined && (
                    <button
                      type="button"
                      onClick={() => onSeekTimestamp?.(note.timestampSeconds!)}
                      className="press rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent hover:bg-accent/20"
                      title="Seek to video timestamp"
                    >
                      @{formatDuration(note.timestampSeconds)}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleUpvote(note.id)}
                  aria-label="Upvote note"
                  className={`press flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    upvoted[note.id]
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border bg-surface-raised text-fg-muted hover:text-fg"
                  }`}
                >
                  <ThumbsUpIcon size={12} />
                  <span className="tabular-nums">{note.helpfulCount}</span>
                </button>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">{note.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
