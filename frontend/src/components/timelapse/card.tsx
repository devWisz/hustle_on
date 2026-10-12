import Link from "next/link";
import type { Timelapse } from "@/lib/types";
import { formatCount, formatDuration, formatSession, formatSol, timeAgo } from "@/lib/format";
import { Avatar } from "../ui/avatar";
import { ArrowRightIcon, EyeIcon, WalletIcon } from "../ui/icons";
import { BookmarkButton } from "./bookmark-button";
import { CardPreview } from "./preview";

export function compression(
  t: Pick<Timelapse, "sessionMinutes" | "durationSeconds">,
): number | null {
  if (t.sessionMinutes <= 0 || t.durationSeconds <= 0) return null;
  const ratio = Math.round((t.sessionMinutes * 60) / t.durationSeconds);
  return ratio > 1 ? ratio : null;
}

export function TimelapseCard({ timelapse: t }: { timelapse: Timelapse }) {
  return (
    <article className="group relative">
      <div className="relative">
        <Link
          href={`/watch/${t.slug}`}
          aria-label={t.title}
          className="lift relative block aspect-video overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-raised"
        >
          <CardPreview
            seed={t.slug}
            title={t.title}
            creator={t.creator.displayName}
            thumbnailUrl={t.thumbnailUrl}
            playbackUrl={t.playbackUrl}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent"
          />
          <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 font-mono text-[11px] text-white">
            <span className="rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur-sm">
              {t.sessionMinutes > 0 ? formatSession(t.sessionMinutes) : "Real time"}
            </span>
            {t.durationSeconds > 0 ? (
              <span className="rounded-md bg-black/55 px-1.5 py-0.5 tabular-nums backdrop-blur-sm">
                {formatDuration(t.durationSeconds)}
              </span>
            ) : null}
          </span>
          {t.featured ? (
            <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-transparent bg-surface/90 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-fg">
              Featured
            </span>
          ) : null}
        </Link>
        <div className="absolute right-3 top-3 z-10">
          <BookmarkButton timelapse={t} />
        </div>
      </div>

      <div className="mt-4 px-0.5">
        <div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
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
              <time dateTime={t.publishedAt} className="shrink-0 text-fg-subtle">
                {timeAgo(t.publishedAt)}
              </time>
            </>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">
          <Link href={`/watch/${t.slug}`} className="transition-colors hover:text-accent">
            {t.title}
          </Link>
        </h3>

        <div className="mt-3 flex items-center gap-4 text-[12.5px] text-fg-subtle">
          <span className="flex items-center gap-1.5 tabular-nums">
            <EyeIcon size={13} />
            {formatCount(t.viewCount)}
          </span>
          {t.donationTotalLamports > 0 ? (
            <span className="tabular-nums text-fg-muted">
              <span className="font-medium text-fg">{formatSol(t.donationTotalLamports)}</span>{" "}
              raised
            </span>
          ) : null}
        </div>

        {/* The image and the title are already links, so these are siblings
            rather than nested anchors — the card does not become a link inside
            a link. Funding is one click from the feed instead of two. */}
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/watch/${t.slug}`}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Watch
            <ArrowRightIcon size={14} className="nudge-icon" />
          </Link>
          <Link
            href={`/watch/${t.slug}#sponsor`}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-medium text-fg transition-colors hover:border-border-strong"
          >
            <WalletIcon size={14} />
            Fund
          </Link>
        </div>
      </div>
    </article>
  );
}
