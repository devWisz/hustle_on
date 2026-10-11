"use client";

import Link from "next/link";
import { useState } from "react";
import { useBookmarks } from "@/lib/bookmarks";
import { ApiError } from "@/lib/api/client";
import { formatSession } from "@/lib/format";
import { BookmarkIcon } from "../ui/icons";
import { Button, Card } from "../ui";
import { useToast } from "../layout/toast";

export function SavedList() {
  const { bookmarks, loaded, signedIn, removeBookmark, hasMore, loadMore } = useBookmarks();
  const { success, error } = useToast();
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleRemove(slug: string) {
    try {
      await removeBookmark(slug);
      success("Removed from your saved sessions");
    } catch (err) {
      error(err instanceof ApiError ? err.message : "That could not be removed.");
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadMore();
    } catch {
      error("Could not load more. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!loaded) return null;

  if (!signedIn) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="text-[15px] font-medium">Saved sessions need an account</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Sign in and the save button on any session keeps it here.
          </p>
        </div>
        <Link href="/login?next=%2Fdashboard" className="text-[13px] font-medium text-accent hover:underline">
          Sign in
        </Link>
      </Card>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="text-[15px] font-medium">Nothing saved yet</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Use the save button on any session to keep it here.
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
        Saved to your account, so the list follows you to another device.
      </p>
      <ul className="space-y-3">
        {bookmarks.map((b) => (
          <li key={b.slug}>
            <Card interactive className="p-4">
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
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(b.slug)}
                  aria-label={`Remove ${b.title} from your saved sessions`}
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

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={handleLoadMore} loading={loadingMore}>
            Load more saved sessions
          </Button>
        </div>
      )}
    </>
  );
}
