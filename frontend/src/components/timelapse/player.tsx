"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Timelapse } from "@/lib/types";
import { formatDuration, formatSession } from "@/lib/format";
import { isSampleSlug } from "@/lib/demo/content";
import { usePlayerSeek } from "./player-seek";
import {
  MaximizeIcon,
  MinimizeIcon,
  PipIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeXIcon,
  ZapIcon,
} from "../ui/icons";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 4];

export function TimelapsePlayer({ timelapse }: { timelapse: Timelapse }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(timelapse.durationSeconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const playingRef = useRef(playing);
  const loopRef = useRef(loop);
  const mutedRef = useRef(muted);
  const durationRef = useRef(duration);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const seek = usePlayerSeek();

  useEffect(() => {
    if (!timelapse.playbackUrl || isSampleSlug(timelapse.slug)) return;
    const timer = setTimeout(() => {
      if (counted.current) return;
      counted.current = true;
      void api(`/v1/timelapses/${timelapse.slug}/views`, { method: "POST" }).catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [timelapse.slug, timelapse.playbackUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoadedMetadata = () => {
      if (v.duration && !isNaN(v.duration)) setDuration(v.duration);
    };
    const onEnded = () => {
      if (!loopRef.current) setPlaying(false);
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playingRef.current) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const skip = useCallback(
    (seconds: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(
        0,
        Math.min(v.duration || durationRef.current, v.currentTime + seconds),
      );
      resetControlsTimer();
    },
    [resetControlsTimer],
  );

  const toggleLoop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !loopRef.current;
    v.loop = next;
    setLoop(next);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !mutedRef.current;
    v.muted = next;
    setMuted(next);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen failed
    }
  }, []);

  useEffect(() => {
    if (!seek) return;
    return seek.register((seconds) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(v.duration || durationRef.current, seconds));
      v.play().catch(() => {});
      resetControlsTimer();
    });
  }, [seek, resetControlsTimer]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
        case "ArrowLeft":
          e.preventDefault();
          skip(-5);
          break;
        case "l":
        case "ArrowRight":
          e.preventDefault();
          skip(5);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "r":
          e.preventDefault();
          toggleLoop();
          break;
        case "f":
          e.preventDefault();
          void toggleFullscreen();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, skip, toggleMute, toggleLoop, toggleFullscreen]);

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    const target = parseFloat(e.target.value);
    v.currentTime = target;
    setCurrentTime(target);
    resetControlsTimer();
  }

  function handleSpeedChange(speed: number) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    resetControlsTimer();
  }

  async function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or rejected
    }
  }

  if (!timelapse.playbackUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface-raised">
        <p className="text-sm text-fg-muted">This timelapse has no video attached yet.</p>
      </div>
    );
  }

  const compressionRatio =
    timelapse.sessionMinutes > 0 && duration > 0
      ? Math.round((timelapse.sessionMinutes * 60) / duration)
      : null;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      tabIndex={0}
      className="group relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)]
                 border border-border bg-black shadow-[var(--shadow-raised)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        poster={timelapse.thumbnailUrl}
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-contain"
      >
        <source src={timelapse.playbackUrl} />
        Your browser cannot play this video.
      </video>

      {!playing && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 transition-opacity"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface/95 text-fg shadow-[var(--shadow-raised)] transition-transform hover:scale-105">
            <PlayIcon size={24} />
          </span>
        </div>
      )}

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3.5 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
      >
        {compressionRatio && compressionRatio > 1 ? (
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <ZapIcon size={12} className="text-accent" />
            <span>
              {formatSession(timelapse.sessionMinutes)} compressed to {formatDuration(duration)}
            </span>
            <span className="rounded bg-accent/20 px-1 py-0.2 font-mono text-[10px] text-accent">
              {compressionRatio}x
            </span>
          </div>
        ) : (
          <div />
        )}

        {loop && (
          <div className="flex items-center gap-1 rounded-full border border-accent/30 bg-black/70 px-2 py-0.5 text-[11px] font-medium text-accent backdrop-blur-md">
            <RepeatIcon size={12} />
            <span>Loop on</span>
          </div>
        )}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="relative mb-2 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek video timeline"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-accent transition-all hover:h-2"
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause (Space/k)" : "Play (Space/k)"}
              className="press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] hover:bg-white/15"
            >
              {playing ? (
                <span className="flex h-3.5 w-3.5 gap-1">
                  <span className="h-full w-1 rounded-xs bg-white" />
                  <span className="h-full w-1 rounded-xs bg-white" />
                </span>
              ) : (
                <PlayIcon size={16} />
              )}
            </button>

            <button
              type="button"
              onClick={() => skip(-5)}
              aria-label="Skip back 5 seconds (j / ←)"
              className="press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/15 hover:text-white"
            >
              <SkipBackIcon size={15} />
            </button>

            <button
              type="button"
              onClick={() => skip(5)}
              aria-label="Skip forward 5 seconds (l / →)"
              className="press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/15 hover:text-white"
            >
              <SkipForwardIcon size={15} />
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute (m)" : "Mute (m)"}
              className="press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/15 hover:text-white"
            >
              {muted ? <VolumeXIcon size={15} /> : <VolumeIcon size={15} />}
            </button>

            <div className="ml-1 font-mono text-[11px] tabular-nums text-white/80">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                aria-label="Playback speed"
                className="press flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-white/20 bg-white/10 px-2 font-mono text-[11px] font-medium text-white hover:bg-white/20"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-9 right-0 z-20 flex min-w-[72px] flex-col overflow-hidden rounded-md border border-border bg-surface p-1 shadow-lg">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`press flex items-center justify-between rounded px-2 py-1 text-left font-mono text-[12px] ${
                        playbackSpeed === s
                          ? "bg-accent/15 font-semibold text-accent"
                          : "text-fg-muted hover:bg-surface-raised hover:text-fg"
                      }`}
                    >
                      <span>{s}x</span>
                      {playbackSpeed === s && <span className="text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleLoop}
              aria-label={loop ? "Disable loop (r)" : "Enable loop (r)"}
              aria-pressed={loop}
              className={`press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                loop
                  ? "border border-accent/40 bg-accent/20 text-accent"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <RepeatIcon size={15} />
            </button>

            <button
              type="button"
              onClick={togglePip}
              aria-label="Picture-in-Picture"
              className="press hidden sm:flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/15 hover:text-white"
            >
              <PipIcon size={15} />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen (f)" : "Enter fullscreen (f)"}
              className="press flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white/80 hover:bg-white/15 hover:text-white"
            >
              {fullscreen ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
