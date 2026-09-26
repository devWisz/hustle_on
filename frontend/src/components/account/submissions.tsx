"use client";

import Link from "next/link";
import { useState } from "react";
import type { Timelapse, TimelapseStatus } from "@/lib/types";
import { cx, formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";
import { EmptyState, StatusBadge } from "../ui";
import { FilmIcon } from "../ui/icons";

const FILTERS: { id: "all" | TimelapseStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "in_review", label: "In review" },
  { id: "rejected", label: "Needs changes" },
];

export function Submissions({ items, linkable }: { items: Timelapse[]; linkable: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const visible = filter === "all" ? items : items.filter((t) => t.status === filter);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter submissions"
        className="scroll-x -mx-4 flex gap-1 px-4 sm:mx-0 sm:px-0"
      >
        {FILTERS.map((f) => {
          const count =
            f.id === "all" ? items.length : items.filter((t) => t.status === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                "press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                filter === f.id
                  ? "bg-inverse text-inverse-fg"
                  : "text-fg-muted hover:bg-surface-raised hover:text-fg",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[11px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<FilmIcon size={18} />}
          title="Nothing here"
          description="No submissions match this filter."
        />
      ) : (
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {visible.map((t) => {
            const href = linkable && t.status === "published" ? `/watch/${t.slug}` : null;
            return (
              <li key={t.id} className="p-4 sm:p-5">
                <div className="flex gap-4">
                  <span className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-raised sm:block">
                    {t.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {href ? (
                          <Link href={href} className="transition-colors hover:text-accent">
                            {t.title}
                          </Link>
                        ) : (
                          t.title
                        )}
                      </h3>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1.5 text-[13px] text-fg-muted">
                      {[
                        t.sessionMinutes > 0 ? formatSession(t.sessionMinutes) : null,
                        `submitted ${timeAgo(t.submittedAt ?? t.createdAt)}`,
                        t.status === "published" ? `${formatCount(t.viewCount)} views` : null,
                        t.donationTotalLamports > 0
                          ? `${formatSol(t.donationTotalLamports)} raised`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {t.status === "rejected" && t.reviewNote ? (
                      <div className="mt-3 rounded-[var(--radius-control)] border border-danger/20 bg-danger-soft px-3.5 py-3">
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-danger">
                          Reviewer note
                        </p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-fg">{t.reviewNote}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
