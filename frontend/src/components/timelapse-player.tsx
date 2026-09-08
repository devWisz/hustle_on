"use client";

import { useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/types";
import { PlayIcon, ShieldIcon } from "./icons";

export function TimelapsePlayer({ video }: { video: Video }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(15);
  const [speed, setSpeed] = useState<number>(30); // 30x timelapse
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
      }, 1000 / (speed / 10));
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed]);

  if (video.playbackUrl) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-black shadow-[var(--shadow-raised)]">
        <video
          controls
          preload="metadata"
          playsInline
          poster={video.thumbnailUrl}
          className="aspect-video w-full"
        >
          <source src={video.playbackUrl} type="video/mp4" />
          Your browser cannot play this video.
        </video>
      </div>
    );
  }

  // Simulated high-fidelity timelapse player for proof-of-work sessions
  const currentMinute = Math.floor((progress / 100) * (video.sessionMinutes || 180));
  const totalMinutes = video.sessionMinutes || 180;
  const hours = Math.floor(currentMinute / 60);
  const mins = currentMinute % 60;
  const formattedTime = `${hours > 0 ? `${hours}h ` : ""}${mins}m`;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-neutral-950 text-white shadow-[var(--shadow-raised)]">
      {/* Interactive visual canvas */}
      <div className="relative flex aspect-video flex-col justify-between p-4 sm:p-6 select-none">
        {/* Top bar */}
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-white font-medium">{video.slug}.rs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
              {speed}x Timelapse
            </span>
            <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
              <ShieldIcon size={13} />
              Verified Proof
            </span>
          </div>
        </div>

        {/* Center Code Evolution Stage */}
        <div className="my-auto font-mono text-[12px] sm:text-[13px] leading-relaxed text-neutral-300 space-y-1">
          <p className="text-neutral-500">{"// Sardhana Timelapse Session #" + video.id.slice(0, 8)}</p>
          <p>
            <span className="text-sky-400">pub async fn</span>{" "}
            <span className="text-amber-300">execute_work_unit</span>(ctx: &amp;Context) -&gt; Result&lt;()&gt; &#123;
          </p>
          <p className="pl-4 text-emerald-400">
            {progress < 30 && "/* Step 1: Initializing data structures & test harness */"}
            {progress >= 30 && progress < 70 && "/* Step 2: Optimizing execution pipeline & zero-copy parser */"}
            {progress >= 70 && "/* Step 3: Verifying benchmarks & writing state to chain */"}
          </p>
          <p className="pl-4">
            state.applied_steps += <span className="text-amber-300">{Math.floor(progress * 1.4)}</span>;
          </p>
          <p className="pl-4 text-neutral-400">
            emit!(WorkLogged &#123; session_min: {currentMinute}, elapsed_real: &quot;{formattedTime}&quot; &#125;);
          </p>
          <p>&#125;</p>
        </div>

        {/* Bottom Playback HUD */}
        <div className="space-y-2.5">
          {/* Progress Bar */}
          <div
            className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const newProgress = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
              setProgress(newProgress);
            }}
          >
            <div
              className="h-full bg-accent transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={isPlaying ? "Pause timelapse" : "Play timelapse"}
              >
                {isPlaying ? (
                  <span className="flex gap-1">
                    <span className="h-3 w-1 bg-white rounded-sm" />
                    <span className="h-3 w-1 bg-white rounded-sm" />
                  </span>
                ) : (
                  <PlayIcon size={14} />
                )}
              </button>

              <span className="font-mono text-neutral-300">
                {formattedTime} / {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {[10, 30, 60, 120].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                    speed === s
                      ? "bg-accent text-accent-fg font-semibold"
                      : "text-neutral-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
