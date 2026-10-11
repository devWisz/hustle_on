"use client";

import { usePathname, useRouter } from "next/navigation";
import { SignInRequiredError, useBookmarks } from "@/lib/bookmarks";
import type { Timelapse } from "@/lib/types";
import { BookmarkIcon } from "../ui/icons";
import { useToast } from "../layout/toast";
import { cx } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

interface BookmarkButtonProps {
  timelapse: Timelapse;
  variant?: "icon" | "inline";
  className?: string;
}

export function BookmarkButton({ timelapse, variant = "icon", className }: BookmarkButtonProps) {
  const { isBookmarked, toggle, signedIn, loaded } = useBookmarks();
  const { success, error } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const saved = isBookmarked(timelapse.slug);

  async function handleClick(e: React.MouseEvent) {
    // Cards are links, so a save button inside one has to stop the navigation
    // before doing anything else.
    e.preventDefault();
    e.stopPropagation();

    // Saving is the one thing a visitor without an account cannot do, so the
    // button says so rather than failing after the fact. It stays a button
    // rather than becoming a link because it lives inside a link already, and an
    // anchor inside an anchor is invalid markup.
    if (loaded && !signedIn) {
      router.push(`/login?next=${encodeURIComponent(`${pathname}#save`)}`);
      return;
    }

    try {
      const nowSaved = await toggle(timelapse);
      success(nowSaved ? "Saved to your account" : "Removed from your saved sessions");
    } catch (err) {
      if (err instanceof SignInRequiredError) {
        router.push(`/login?next=${encodeURIComponent(`${pathname}#save`)}`);
        return;
      }
      error(
        err instanceof ApiError
          ? err.message
          : "That could not be saved. Check your connection and try again.",
      );
    }
  }

  const label = saved
    ? "Remove from saved sessions"
    : loaded && !signedIn
      ? "Sign in to save this session"
      : "Save session";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
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
      aria-label={label}
      aria-pressed={saved}
      className={cx(
        "press flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200",
        saved
          ? "border-accent/40 bg-accent text-accent-fg opacity-100 shadow-sm"
          : "border-border/60 bg-black/60 text-white/80 backdrop-blur-sm hover:border-white/40 hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
        className,
      )}
    >
      <BookmarkIcon size={14} filled={saved} />
    </button>
  );
}
