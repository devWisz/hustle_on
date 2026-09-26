"use client";

import Link from "next/link";
import { useBookmarks } from "@/lib/bookmarks";
import { ApiError } from "@/lib/api";
import { formatSession, timeAgo } from "@/lib/format";
import { BookmarkIcon } from "./icons";
import { Card } from "./ui";
import { useToast } from "./toast";

/**
 * The reader's saved list.
 *
 * It is a client component because where the list lives depends on who is
 * asking: the API for an account, this browser otherwise. Rendering it on the
 * server would have to pick one of those and be wrong for the other.
 */
export function SavedList() {
  const { bookmarks, loaded, signedIn, removeBookmark } = useBookmarks();
  const { success, error } = useToast();

  async function handleRemove(slug: string) {
    try {
      await removeBookmark(slug);
      success("Removed from your bookmarks");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That could not be removed.");
    }
  }

  // Nothing is claimed until the list is actually known: an empty-state message
  // shown while the account's list is still loading is a lie for a moment.
  if (!loaded) return null;

  if (bookmarks.length === 0) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="text-[15px] font-medium">Nothing saved yet</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Use the save button on any timelapse to keep it here for later.
          </p>
        </div>
        <Link href="/" className="text-[13px] font-medium text-accent hover:underline">
          Browse the feed
        </Link>
      </Card>
    );
  }

  return (
    <>
      <p className="mb-3 text-[13px] text-fg-subtle">
        {signedIn
          ? "Saved to your account, so the list follows you to another device."
          : "Saved in this browser. Sign in to keep the list across devices."}
      </p>
      <ul className="stagger-children space-y-3">
        {bookmarks.map((b) => (
          <li key={b.slug}>
            <Card className="card-hover p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium">
                    <Link href={`/watch/${b.slug}`} className="transition-colors hover:text-accent">
                      {b.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-[13px] text-fg-muted">
                    {b.creator.displayName}
                    {b.sessionMinutes > 0 ? ` · ${formatSession(b.sessionMinutes)}` : ""}
                    {` · saved ${timeAgo(b.savedAt)}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(b.slug)}
                  aria-label={`Remove ${b.title} from your bookmarks`}
                  className="press flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-2.5 text-[12px] font-medium text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg"
                >
                  <BookmarkIcon size={13} filled />
                  Remove
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
