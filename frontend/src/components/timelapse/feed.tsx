import Link from "next/link";
import { cx } from "@/lib/format";

/**
 * The order the feed is read in.
 *
 * These are plain links rather than client-side state so the order survives a
 * reload, a shared URL and a back button, and so the first paint on a slow
 * connection is already the order that was asked for. The values match
 * store.FeedSort on the API; anything else falls back to newest first.
 */

export const FEED_SORTS = [
  { value: "", label: "Newest" },
  { value: "funded", label: "Most funded" },
  { value: "watched", label: "Most watched" },
  { value: "longest", label: "Longest sessions" },
] as const;

export type FeedSort = (typeof FEED_SORTS)[number]["value"];

/** Narrows an arbitrary query-string value to a sort the API understands. */
export function parseSort(value: string | string[] | undefined): FeedSort {
  const first = Array.isArray(value) ? value[0] : value;
  const hit = FEED_SORTS.find((s) => s.value === first);
  return hit ? hit.value : "";
}

export function FeedTabs({ active }: { active: FeedSort }) {
  return (
    <div
      role="tablist"
      aria-label="Sort timelapses"
      // Scrolls rather than wraps on a narrow screen, so the row stays one
      // line and the selected chip is never orphaned below the others.
      className="scroll-x-hidden -mx-5 flex gap-1.5 px-5 sm:mx-0 sm:px-0"
    >
      {FEED_SORTS.map((sort) => {
        const selected = sort.value === active;
        return (
          <Link
            key={sort.value || "recent"}
            href={sort.value ? `/?sort=${sort.value}#feed` : "/#feed"}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={cx(
              "press shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium",
              "transition-colors duration-200",
              selected
                ? "border-transparent bg-accent text-accent-fg"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {sort.label}
          </Link>
        );
      })}
    </div>
  );
}
