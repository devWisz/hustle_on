import Link from "next/link";
import type { Timelapse } from "@/lib/types";
import { cx, formatCount, formatDuration, formatSession, formatSol, timeAgo } from "@/lib/format";
import { getTimelapseTags } from "@/lib/tags";
import { Avatar } from "../ui/button";
import { SampleTag } from "./guest";
import { CardPreview } from "./card-preview";
import { ClockIcon, EyeIcon, ZapIcon } from "../ui/icons";
import { BookmarkButton } from "./bookmark-button";

/**
 * One timelapse in a list.
 *
 * The hierarchy is deliberate: the title, then what the session was worth in
 * real hours, then who made it. The donation total sits last and quiet — this
 * is a record of work, and a leaderboard would make it something else.
 */
export function TimelapseCard({
  timelapse,
  sample = false,
}: {
  timelapse: Timelapse;
  /** Marks an invented record, so nobody mistakes a preview for the real feed. */
  sample?: boolean;
}) {
  const t = timelapse;
  const tags = getTimelapseTags(t);
  const compressionRatio =
    t.sessionMinutes > 0 && t.durationSeconds > 0
      ? Math.round((t.sessionMinutes * 60) / t.durationSeconds)
      : null;

  return (
    <article className="group">
      <div className="relative">
        <Link
          href={`/watch/${t.slug}`}
          aria-label={t.title}
          className="card-hover relative block overflow-hidden rounded-[var(--radius-card)]
                     border border-border bg-surface-raised"
        >
          <div className="relative aspect-video w-full overflow-hidden">
            <CardPreview
              seed={t.slug}
              title={t.title}
              creator={t.creator.displayName}
              thumbnailUrl={t.thumbnailUrl}
              playbackUrl={t.playbackUrl}
            />

            {/* A quiet scrim so the corner labels read over any frame. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent"
            />

            {sample ? <SampleTag className="absolute left-2.5 top-2.5 bg-surface/90">Demo</SampleTag> : null}

            <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
              {compressionRatio && compressionRatio > 1 ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5
                             font-mono text-[10.5px] font-medium tabular-nums text-white backdrop-blur-sm"
                  title={`Compressed ${compressionRatio}x from real work`}
                >
                  <ZapIcon size={10} />
                  {compressionRatio}x
                </span>
              ) : (
                <span />
              )}
              {t.durationSeconds > 0 ? (
                <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white backdrop-blur-sm">
                  {formatDuration(t.durationSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        </Link>

        {/* Quick save. Not offered on a sample record: saving one would put an
            invented timelapse into a real saved list, where its link would then
            404 the moment the preview ended. */}
        {sample ? null : (
          <div className="absolute right-2 top-2 z-10">
            <BookmarkButton timelapse={t} />
          </div>
        )}
      </div>

      <div className="mt-3.5 flex gap-3">
        <Link href={`/creator/${t.creator.handle}`} className="mt-0.5 shrink-0" tabIndex={-1} aria-hidden>
          <Avatar name={t.creator.displayName} src={t.creator.avatarUrl} size={32} />
        </Link>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
            <Link href={`/watch/${t.slug}`} className="transition-colors hover:text-accent">
              {t.title}
            </Link>
          </h3>

          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-fg-muted">
            <Link
              href={`/creator/${t.creator.handle}`}
              className="truncate transition-colors hover:text-fg"
            >
              {t.creator.displayName}
            </Link>
            {t.publishedAt ? (
              <>
                <span aria-hidden className="text-fg-subtle">
                  ·
                </span>
                <time dateTime={t.publishedAt} className="shrink-0">
                  {timeAgo(t.publishedAt)}
                </time>
              </>
            ) : null}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-fg-subtle">
            {t.sessionMinutes > 0 ? (
              <span className="flex items-center gap-1">
                <ClockIcon size={12} />
                {formatSession(t.sessionMinutes)}
              </span>
            ) : null}
            <span className="flex items-center gap-1 tabular-nums">
              <EyeIcon size={12} />
              {formatCount(t.viewCount)}
            </span>
            {t.donationTotalLamports > 0 ? (
              <span className="font-medium tabular-nums text-accent">
                {formatSol(t.donationTotalLamports)}
              </span>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] font-medium text-fg-subtle ring-1 ring-inset ring-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** The grid every list of timelapses uses, so column counts stay consistent. */
export function TimelapseGrid({
  items,
  sample = false,
  className,
}: {
  items: Timelapse[];
  sample?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("stagger-children grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((t) => (
        <TimelapseCard key={t.id} timelapse={t} sample={sample} />
      ))}
    </div>
  );
}
