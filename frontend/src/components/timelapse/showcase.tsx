"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Timelapse } from "@/lib/types";
import { cx, formatSession } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { ArrowRightIcon, PlayIcon } from "../ui/icons";
import { compression } from "./card";

export function Showcase({
  items,
  fallback,
  demo = false,
}: {
  items: Timelapse[];
  fallback: Timelapse[];
  demo?: boolean;
}) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const working = items.filter((t) => t.playbackUrl && !failed.has(t.id));
  const usingFallback = working.length === 0;
  const reel = (usingFallback ? fallback : working).slice(0, 4);
  const isDemo = demo || usingFallback;

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const current = reel[index % Math.max(reel.length, 1)];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [current?.id, playing]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from("[data-caption]", {
          yPercent: 100,
          autoAlpha: 0,
          stagger: 0.06,
          duration: 0.7,
          ease: "expo.out",
        });
      });
    },
    { dependencies: [current?.id], scope: caption },
  );

  const go = useCallback(
    (next: number) => {
      setProgress(0);
      setIndex(((next % reel.length) + reel.length) % reel.length);
    },
    [reel.length],
  );

  if (!current) return null;
  const ratio = compression(current);

  return (
    <figure className="w-full">
      <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-black shadow-[var(--shadow-lifted)]">
        <div className="relative aspect-[16/10] sm:aspect-video">
          <video
            ref={video}
            src={current.playbackUrl}
            poster={current.thumbnailUrl}
            muted
            playsInline
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => go(index + 1)}
            onError={() => {
              if (usingFallback) return;
              setProgress(0);
              setFailed((prev) => new Set(prev).add(current.id));
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
          />

          <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/85 sm:left-6 sm:right-6 sm:top-6">
            <span className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-md">
              <span
                aria-hidden
                className={cx("h-1.5 w-1.5 rounded-full bg-white", playing && "animate-blink")}
              />
              {isDemo ? "Demo reel" : "Now playing"}
            </span>
            {ratio ? (
              <span className="rounded-full bg-black/45 px-3 py-1.5 tabular-nums backdrop-blur-md">
                {ratio}x speed
              </span>
            ) : null}
          </div>

          <div
            ref={caption}
            className="absolute inset-x-4 bottom-4 flex flex-col gap-4 sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between"
          >
            <div className="min-w-0 overflow-hidden text-white">
              <p data-caption className="text-[13px] text-white/70">
                {current.creator.displayName}
                {current.sessionMinutes > 0 ? ` · ${formatSession(current.sessionMinutes)}` : ""}
              </p>
              <p
                data-caption
                className="mt-1 max-w-2xl text-[clamp(1.15rem,0.9rem+1.2vw,1.9rem)] font-semibold leading-tight tracking-tight"
              >
                {current.title}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause the reel" : "Play the reel"}
                className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
              >
                {playing ? (
                  <span aria-hidden className="flex gap-1">
                    <span className="h-3.5 w-1 rounded-sm bg-current" />
                    <span className="h-3.5 w-1 rounded-sm bg-current" />
                  </span>
                ) : (
                  <PlayIcon size={16} />
                )}
              </button>
              <Link
                href={`/watch/${current.slug}`}
                className="press group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black transition-opacity hover:opacity-90"
              >
                Watch session
                <ArrowRightIcon size={15} className="nudge-icon" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Featured sessions"
        className="scroll-x mt-4 grid auto-cols-[minmax(200px,1fr)] grid-flow-col gap-3"
      >
        {reel.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                go(i);
                setPlaying(true);
              }}
              className={cx(
                "group rounded-[var(--radius-control)] px-1 pb-2 pt-3 text-left transition-opacity",
                selected ? "opacity-100" : "opacity-55 hover:opacity-90",
              )}
            >
              <span className="block h-[3px] overflow-hidden rounded-full bg-border">
                <span
                  className="block h-full origin-left rounded-full bg-fg"
                  style={{
                    transform: `scaleX(${i < index ? 1 : selected ? progress : 0})`,
                    transition: selected ? "transform 0.25s linear" : "none",
                  }}
                />
              </span>
              <span className="mt-3 block font-mono text-[11px] text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 line-clamp-1 block text-[13.5px] font-medium text-fg">
                {t.title}
              </span>
            </button>
          );
        })}
      </div>
    </figure>
  );
}
