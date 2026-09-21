"use client";

import { useBookmarks } from "@/lib/bookmarks";
import type { Timelapse } from "@/lib/types";
import { BookmarkIcon } from "./icons";
import { useToast } from "./toast";
import { cx } from "@/lib/format";

interface BookmarkButtonProps {
  timelapse: Timelapse;
  variant?: "icon" | "inline";
  className?: string;
}

export function BookmarkButton({
  timelapse,
  variant = "icon",
  className,
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { success } = useToast();
  const saved = isBookmarked(timelapse.slug);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nowSaved = toggleBookmark(timelapse);
    if (nowSaved) {
      success("Saved to your bookmarks");
    } else {
      success("Removed from bookmarks");
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={saved ? "Remove from bookmarks" : "Save timelapse"}
        aria-pressed={saved}
        className={cx(
          "press inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
          saved
            ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
            : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
          className,
        )}
      >
        <BookmarkIcon size={14} filled={saved} className={saved ? "text-accent" : ""} />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? "Remove from bookmarks" : "Save timelapse"}
      aria-pressed={saved}
      className={cx(
        "press flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200",
        saved
          ? "border-accent/40 bg-accent text-accent-fg opacity-100 shadow-sm"
          : "border-border/60 bg-black/60 text-white/80 backdrop-blur-sm hover:border-white/40 hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover:opacity-100",
        className,
      )}
    >
      <BookmarkIcon size={14} filled={saved} />
    </button>
  );
}
