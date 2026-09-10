import Link from "next/link";
import type { Timelapse } from "@/lib/types";
import { formatCount, formatDuration, formatSession, formatSol, timeAgo } from "@/lib/format";
import { Avatar } from "./ui";
import { ClockIcon, EyeIcon, PlayIcon } from "./icons";

/**
 * One timelapse in a list.
 *
 * The hierarchy is deliberate: the title, then what the session was worth in
 * real hours, then who made it. The donation total sits last and quiet — this
 * is a record of work, and a leaderboard would make it something else.
 */
export function TimelapseCard({ timelapse }: { timelapse: Timelapse }) {
  const t = timelapse;
  return (
    <article className="group">
      <Link
        href={`/watch/${t.slug}`}
        className="block overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised
                   card-hover"
      >
        <div className="relative aspect-video w-full overflow-hidden">
          {t.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-raised text-fg-subtle">
              <PlayIcon size={28} />
            </div>
          )}

          {/* Play overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-fg
                            opacity-0 scale-75 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100
                            shadow-lg">
              <PlayIcon size={20} />
            </span>
          </div>

          {t.durationSeconds > 0 ? (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[11px] tabular-nums text-white backdrop-blur-sm">
              {formatDuration(t.durationSeconds)}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="mt-3">
        <h3 className="text-[15px] font-medium leading-snug">
          <Link href={`/watch/${t.slug}`} className="transition-colors hover:text-accent">
            {t.title}
          </Link>
        </h3>

        {t.sessionMinutes > 0 ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-muted">
            <ClockIcon size={13} />
            {formatSession(t.sessionMinutes)}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center gap-2 text-[13px] text-fg-muted">
          <Link
            href={`/creator/${t.creator.handle}`}
            className="flex items-center gap-2 transition-colors hover:text-fg"
          >
            <Avatar name={t.creator.displayName} src={t.creator.avatarUrl} size={20} />
            {t.creator.displayName}
          </Link>
          {t.publishedAt ? (
            <>
              <span aria-hidden className="text-fg-subtle">
                ·
              </span>
              <time dateTime={t.publishedAt}>{timeAgo(t.publishedAt)}</time>
            </>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-4 text-[12px] text-fg-subtle">
          <span className="flex items-center gap-1 tabular-nums">
            <EyeIcon size={13} />
            {formatCount(t.viewCount)}
          </span>
          {t.donationTotalLamports > 0 ? (
            <span className="tabular-nums text-accent">{formatSol(t.donationTotalLamports)} received</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** The grid every list of timelapses uses, so column counts stay consistent. */
export function TimelapseGrid({ items }: { items: Timelapse[] }) {
  return (
    <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
      {items.map((t) => (
        <TimelapseCard key={t.id} timelapse={t} />
      ))}
    </div>
  );
}
