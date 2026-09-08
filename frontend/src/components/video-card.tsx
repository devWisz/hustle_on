import Link from "next/link";
import type { Video } from "@/lib/types";
import { formatCount, formatDuration, formatSession, formatSol, timeAgo } from "@/lib/format";
import { Avatar } from "./ui";
import { PlayIcon } from "./icons";

/**
 * One session in a grid.
 *
 * The card leads with the thumbnail, then the title, then the person. Below
 * that sit the two numbers that matter here: how long the work actually took,
 * and how much it has earned. Views are deliberately the least prominent — the
 * platform is not ranking attention.
 */
export function VideoCard({ video, priority = false }: { video: Video; priority?: boolean }) {
  return (
    <article className="group relative">
      <Link
        href={`/watch/${video.slug}`}
        className="relative block overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised transition-all duration-300 group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[var(--shadow-raised)]"
      >
        <div className="relative aspect-video overflow-hidden">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt=""
              loading={priority ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-surface-raised text-fg-subtle">
              <PlayIcon size={32} />
            </div>
          )}

          {/* Hover play button pulse overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition-transform duration-300 group-hover:scale-110">
              <PlayIcon size={20} />
            </span>
          </div>

          {/* Glass duration badge */}
          <span className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/70 px-2 py-0.5 text-[11px] font-mono font-medium tabular-nums text-white backdrop-blur-md shadow-sm">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>
      </Link>

      <div className="mt-3 flex gap-3">
        <Link href={`/creator/${video.creator.handle}`} aria-label={video.creator.displayName}>
          <Avatar name={video.creator.displayName} src={video.creator.avatarUrl} size={32} />
        </Link>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">
            <Link href={`/watch/${video.slug}`} className="line-clamp-2 hover:text-accent">
              {video.title}
            </Link>
          </h3>
          <p className="mt-1 truncate text-[13px] text-fg-muted">
            <Link href={`/creator/${video.creator.handle}`} className="hover:text-fg">
              {video.creator.displayName}
            </Link>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-fg-subtle">
            {video.sessionMinutes ? (
              <>
                <span>{formatSession(video.sessionMinutes)}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span>{formatCount(video.viewCount)} views</span>
            {video.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>{timeAgo(video.publishedAt)}</span>
              </>
            ) : null}
          </p>
          {video.sponsorTotalLamports > 0 ? (
            <p className="mt-1.5 text-[12px] font-medium text-accent">
              {formatSol(video.sponsorTotalLamports)} sponsored
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A responsive grid of cards, used on the home feed, discover and profiles. */
export function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video, index) => (
        <VideoCard key={video.id} video={video} priority={index < 3} />
      ))}
    </div>
  );
}

/**
 * The grid's loading shape.
 *
 * It mirrors `VideoCard`'s geometry exactly — same aspect ratio, same avatar
 * size, same line offsets — so nothing shifts position when the real cards
 * replace it. A skeleton that does not match is worse than no skeleton.
 */
export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <div className="aspect-video animate-pulse rounded-[var(--radius-card)] bg-surface-raised" />
          <div className="mt-3 flex gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-raised" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-raised" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-surface-raised" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
