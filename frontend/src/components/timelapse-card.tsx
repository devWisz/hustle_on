import Link from "next/link";
import type { Timelapse } from "@/lib/types";
import { cx, formatCount, formatDuration, formatSession, formatSol, timeAgo } from "@/lib/format";
import { getTimelapseTags } from "@/lib/tags";
import { Avatar } from "./ui";
import { SampleTag } from "./guest";
import { ThumbArtwork } from "./thumb";
import { ClockIcon, EyeIcon, PlayIcon, ZapIcon } from "./icons";
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
          className="card-hover relative block overflow-hidden rounded-[var(--radius-card)]
                     border border-border bg-surface-raised"
        >
          <div className="relative aspect-video w-full overflow-hidden">
            {t.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]">
                <ThumbArtwork seed={t.slug} title={t.title} creator={t.creator.displayName} />
              </div>
            )}

            {/* The play affordance. */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/0
                         transition-colors duration-300 group-hover:bg-black/25"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg
                           shadow-[var(--shadow-raised)] transition-all duration-300
                           sm:scale-90 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100"
              >
                <PlayIcon size={18} />
              </span>
            </div>

            {sample ? <SampleTag className="absolute left-2 top-2 bg-surface/90" /> : null}

            {compressionRatio && compressionRatio > 1 ? (
              <span
                className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5
                           font-mono text-[10px] font-medium tracking-tight text-accent backdrop-blur-sm"
                title={`Compressed ${compressionRatio}x from real work`}
              >
                <ZapIcon size={10} />
                {compressionRatio}x speed
              </span>
            ) : null}

            {t.durationSeconds > 0 ? (
              <span
                className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5
                           font-mono text-[11px] tabular-nums text-white backdrop-blur-sm"
              >
                {formatDuration(t.durationSeconds)}
              </span>
            ) : null}
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

      <div className="mt-3">
        {/* Two lines, always. */}
        <h3 className="line-clamp-2 min-h-[2.7em] text-[15px] font-medium leading-snug">
          <Link href={`/watch/${t.slug}`} className="transition-colors hover:text-accent">
            {t.title}
          </Link>
        </h3>

        {/* Tags */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle"
            >
              {tag}
            </span>
          ))}
        </div>

        {t.sessionMinutes > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-fg-muted">
            <ClockIcon size={13} className="shrink-0 text-fg-subtle" />
            {formatSession(t.sessionMinutes)}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted">
          <Link
            href={`/creator/${t.creator.handle}`}
            className="flex min-w-0 items-center gap-2 transition-colors hover:text-fg"
          >
            <Avatar name={t.creator.displayName} src={t.creator.avatarUrl} size={20} />
            <span className="truncate">{t.creator.displayName}</span>
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
        </div>

        <div className="mt-2 flex items-center gap-4 text-[12px] text-fg-subtle">
          <span className="flex items-center gap-1 tabular-nums">
            <EyeIcon size={13} />
            {formatCount(t.viewCount)}
          </span>
          {t.donationTotalLamports > 0 ? (
            <span className="tabular-nums text-accent">
              {formatSol(t.donationTotalLamports)} received
            </span>
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
    <div className={cx("stagger-children grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((t) => (
        <TimelapseCard key={t.id} timelapse={t} sample={sample} />
      ))}
    </div>
  );
}
