"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./ui";
import { BriefcaseIcon, PlayIcon, ShieldIcon, WalletIcon } from "./icons";

export function HeroShowcase() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(62);
  const [secondsElapsed, setSecondsElapsed] = useState(13350); // ~3h 42m in seconds
  const totalSeconds = 15900; // 4h 25m

  // 3D Tilt state
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  // Timelapse scrubbing simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 0.4;
      });
      setSecondsElapsed((prev) => {
        if (prev >= totalSeconds) return 0;
        return prev + 30; // 30x timelapse speed
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Subtle tilt
    setRotate({
      x: -y / 35,
      y: x / 35,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: "transform 0.15s ease-out",
      }}
      className="relative mx-auto w-full max-w-md rounded-[var(--radius-panel)] border border-border bg-surface p-5
                 shadow-[var(--shadow-raised)] transition-all duration-300 hover:border-border-strong"
    >
      {/* Creator Info Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name="Alex Vance" size={40} />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">Alex Vance</p>
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                VERIFIED
              </span>
            </div>
            <p className="text-[12px] text-fg-subtle">@alex_vance · Rust & Solana</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-fg-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px]">RECORDED</span>
          </span>
        </div>
      </div>

      {/* Interactive Clean Timelapse Preview */}
      <div className="relative mt-4 overflow-hidden rounded-[var(--radius-card)] border border-border bg-neutral-950 p-4 text-white">
        {/* Top Header of code IDE */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
            </span>
            <span className="font-mono text-[11px] text-neutral-300">hustler_escrow.rs</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-neutral-300 transition-colors hover:bg-white/20"
              aria-label={isPlaying ? "Pause timelapse preview" : "Play timelapse preview"}
            >
              <PlayIcon size={10} className={isPlaying ? "text-accent" : ""} />
              {isPlaying ? "30x SPEED" : "PAUSED"}
            </button>
          </div>
        </div>

        {/* Real Code Snippet */}
        <div className="my-3 font-mono text-[12px] leading-relaxed text-neutral-300">
          <p>
            <span className="text-sky-400">pub fn</span>{" "}
            <span className="text-amber-300">release_milestone</span>(ctx: Context, m: u8) {"{"}
          </p>
          <p className="pl-4 text-emerald-400">{"// debit vault PDA & transfer lamports"}</p>
          <p className="pl-4">{"debit_vault(&vault, &talent, payout)?;"}</p>
          <p className="pl-4 text-neutral-500">{"emit!(MilestoneReleased { ... });"}</p>
          <p className="flex items-center">
            <span>{"}"}</span>
            <span className="ml-1 inline-block h-4 w-1.5 bg-accent" />
          </p>
        </div>

        {/* Animated Timelapse Scrub Bar */}
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
            <span>{formatTime(secondsElapsed)}</span>
            <span className="text-neutral-300">4h 25m real work</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
            {/* Clean scrubber head */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border border-neutral-900 bg-white"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card Footer telemetry */}
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <ShieldIcon size={13} />
            Verified On-Chain
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
            1080p · 60fps
          </span>
        </div>
      </div>

      {/* Floating Settlement Event Notifications */}
      <div className="mt-4 space-y-2.5">
        <div className="group/item flex items-center justify-between rounded-[var(--radius-control)] border border-border bg-bg/80 px-3.5 py-2.5 transition-all duration-200 hover:border-accent/40 hover:bg-bg">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent transition-transform group-hover/item:scale-110">
              <WalletIcon size={15} />
            </span>
            <div>
              <p className="text-[12px] font-medium text-fg">Sponsorship received</p>
              <p className="text-[11px] text-fg-subtle">&quot;Keep building the Solana engine!&quot;</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] font-semibold text-accent">+1.50 SOL</p>
            <p className="text-[10px] font-mono text-emerald-500">settled</p>
          </div>
        </div>

        <div className="group/item flex items-center justify-between rounded-[var(--radius-control)] border border-border bg-bg/80 px-3.5 py-2.5 transition-all duration-200 hover:border-accent/40 hover:bg-bg">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-fg transition-transform group-hover/item:scale-110">
              <BriefcaseIcon size={15} />
            </span>
            <div>
              <p className="text-[12px] font-medium text-fg">Hire Escrow: Milestone 2/3</p>
              <p className="text-[11px] text-fg-subtle">Smart contract audit</p>
            </div>
          </div>
          <span className="inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            Released
          </span>
        </div>
      </div>
    </div>
  );
}
