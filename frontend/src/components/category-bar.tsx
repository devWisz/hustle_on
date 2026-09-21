"use client";

import { CATEGORIES } from "@/lib/tags";
import { cx } from "@/lib/format";
import { TagIcon } from "./icons";

interface CategoryBarProps {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  counts?: Record<string, number>;
}

export function CategoryBar({
  selectedCategory,
  onSelectCategory,
  counts,
}: CategoryBarProps) {
  return (
    <div
      role="group"
      aria-label="Filter by topic"
      className="scroll-x-hidden -mx-5 flex items-center gap-1.5 px-5 sm:mx-0 sm:px-0 py-1"
    >
      <div className="mr-1 hidden items-center gap-1.5 text-[12px] font-medium text-fg-subtle sm:flex">
        <TagIcon size={13} />
        <span>Topics</span>
      </div>

      {CATEGORIES.map((cat) => {
        const active = selectedCategory === cat.id;
        const count = counts?.[cat.id];

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            aria-pressed={active}
            className={cx(
              "press shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
              active
                ? "border-accent bg-accent/10 text-accent font-semibold"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {cat.label}
            {count !== undefined && count > 0 ? (
              <span className="ml-1.5 opacity-60 tabular-nums font-normal">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
