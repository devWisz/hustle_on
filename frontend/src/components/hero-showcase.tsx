"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Timelapse } from "@/lib/types";
import { cx, formatSession } from "@/lib/format";
import { ArrowRightIcon, PlayIcon } from "./icons";

/**
 * The hero's moving picture: real timelapses, playing one after another.
 *
 * It replaces an illustration of the product with the product itself. Each
 * session plays muted and inline, then hands over to the next; the segment
 * rail along the top shows where the reel is and doubles as a way to jump.
 *
 * Live records are tried first. A record whose file will not load is skipped,
 * and if none of them load the reel falls back to the demo library, labelled
 * as such — a hero that sits on a black rectangle is worse than no hero.
 *
 * Reduced motion gets the first poster and a play button, nothing automatic.
 */
export function HeroShowcase({
  items,
  fallback,
  sample = false,
}: {
  items: Timelapse[];
  fallback: Timelapse[];
  sample?: boolean;
}) {
  const playable = items.filter((t) => t.playbackUrl);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const working = playable.filter((t) => !failed.has(t.id));
  const usingFallback = working.length === 0;
  const reel = (usingFallback ? fallback : working).slice(0, 5);
  const isDemo = sample || usingFallback;

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAutoplay(false);
  }, []);

  const current = reel[index % Math.max(reel.length, 1)];

  const go = useCallback(
    (next: number) => {
      setProgress(0);
      setIndex(((next % reel.length) + reel.length) % reel.length);
    },
    [reel.length],
  );

  // The source is set on the element itself, so a failed file raises `error`
  // on the video (a failing <source> child would raise it there instead).
  // Changing `src` reloads it; this only has to start playback again.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    v.play().catch(() => setAutoplay(false));
  }, [current?.id, autoplay]);

  if (!current) return null;

  const ratio =
    current.sessionMinutes > 0 && current.durationSeconds > 0
      ? Math.round((current.sessionMinutes * 60) / current.durationSeconds)
      : null;

  return (
    <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-raised)]">
        {/* Segment rail: one bar per session, filling as it plays. */}
        <div className="flex gap-1.5 px-3 pt-3" role="tablist" aria-label="Featured sessions">
          {reel.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Play ${t.title}`}
              onClick={() => {
                go(i);
                setAutoplay(true);
              }}
              className="group relative h-4 flex-1 cursor-pointer"
            >
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-border transition-colors group-hover:bg-border-strong">
                <span
                  className="block h-full origin-left rounded-full bg-fg"
                  style={{
                    transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})`,
                    transition: i === index ? "transform 0.25s linear" : "none",
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="relative mt-3 aspect-video bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            src={current.playbackUrl}
            poster={current.thumbnailUrl}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => go(index + 1)}
            onError={() => {
              // Dropping the record shifts the next one into this slot, so the
              // index stays where it is. Demo files are ours and are not dropped.
              if (usingFallback) return;
              setProgress(0);
              setFailed((prev) => new Set(prev).add(current.id));
            }}
            className="h-full w-full object-cover"
          />

          {!autoplay ? (
            <button
              type="button"
              onClick={() => setAutoplay(true)}
              className="press absolute inset-0 flex items-center justify-center bg-black/20"
              aria-label="Play the featured sessions"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-fg shadow-[var(--shadow-raised)]">
                <PlayIcon size={20} />
              </span>
            </button>
          ) : null}

          {isDemo ? (
            <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
              Demo
            </span>
          ) : null}
          {ratio && ratio > 1 ? (
            <span className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] tabular-nums text-white backdrop-blur-sm">
              {ratio}x
            </span>
          ) : null}
        </div>

        <figcaption className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          <div key={current.id} className="animate-fade-in min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{current.title}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">
              {current.creator.displayName}
              {current.sessionMinutes > 0 ? (
                <>
                  <span aria-hidden className="mx-1.5 text-fg-subtle">
                    /
                  </span>
                  {formatSession(current.sessionMinutes)}
                </>
              ) : null}
            </p>
          </div>
          <Link
            href={`/watch/${current.slug}`}
            className={cx(
              "press group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5",
              "text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-surface-raised",
            )}
          >
            Watch
            <ArrowRightIcon size={14} className="nudge-icon" />
          </Link>
        </figcaption>
      </div>
    </figure>
  );
}
