"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { fetchAdminNotes } from "@/lib/pagination";
import { cx, formatDuration, timeAgo } from "@/lib/format";
import type { AdminNote } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Button, EmptyState, PagedList, SearchField } from "../ui";
import { MessageSquareIcon, ThumbsUpIcon } from "../ui/icons";
import { Panel, rowPad } from "./console";

export function NotesModeration({
  initial,
  initialCursor,
}: {
  initial: AdminNote[];
  initialCursor?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * Pages keep arriving in the browser while a note is being removed, so this
   * component does not own the list: a removal records the id here and the
   * render drops it from whatever the pager holds, including later pages that
   * still contain it.
   */
  const [removed, setRemoved] = useState<string[]>([]);

  async function remove(n: AdminNote) {
    setBusy(n.id);
    try {
      await api(`/v1/timelapses/${encodeURIComponent(n.timelapse.slug)}/notes/${n.id}`, {
        method: "DELETE",
      });
      setRemoved((current) => [...current, n.id]);
      toast.success("Note removed and recorded in the audit trail.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That note could not be removed.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <PagedList
      initial={initial}
      initialCursor={initialCursor}
      load={fetchAdminNotes}
      label="Load more notes"
      errorText="More notes could not be loaded. Try again."
      className="mt-5 flex flex-col items-center gap-3"
      render={(all) => {
        const notes = all.filter((n) => !removed.includes(n.id));
        const q = query.trim().toLowerCase();
        const visible = q
          ? notes.filter((n) =>
              `${n.body} ${n.author.displayName} ${n.author.handle} ${n.timelapse.title}`
                .toLowerCase()
                .includes(q),
            )
          : notes;

        return (
          <div>
            <SearchField
              placeholder="Search notes, people or sessions"
              aria-label="Search notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-sm"
            />
            {visible.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<MessageSquareIcon size={18} />}
                title={notes.length ? "No notes match" : "No notes yet"}
                description="Notes people leave on published sessions appear here, newest first."
              />
            ) : (
              <Panel as="ul" rows className="mt-5">
                {visible.map((n) => (
                  <li
                    key={n.id}
                    className={cx(rowPad, "flex flex-col gap-3 sm:flex-row sm:items-start")}
                  >
                    <Avatar name={n.author.displayName} src={n.author.avatarUrl} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                        <Link
                          href={`/creator/${n.author.handle}`}
                          className="font-medium hover:underline"
                        >
                          {n.author.displayName}
                        </Link>
                        <span className="text-fg-subtle">on</span>
                        <Link
                          href={`/watch/${n.timelapse.slug}`}
                          className="min-w-0 truncate text-fg-muted hover:text-fg"
                        >
                          {n.timelapse.title}
                        </Link>
                        {n.timestampSeconds !== undefined ? (
                          <span className="font-mono text-[11.5px] text-fg-subtle">
                            at {formatDuration(n.timestampSeconds)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">
                        {n.body}
                      </p>
                      <p className="mt-2 flex items-center gap-3 text-[12px] text-fg-subtle">
                        <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUpIcon size={12} />
                          {n.helpfulCount}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {confirming === n.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busy === n.id}
                            onClick={() => void remove(n)}
                          >
                            Remove
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(n.id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </Panel>
            )}
          </div>
        );
      }}
    />
  );
}
