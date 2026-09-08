"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicStats } from "@/lib/types";
import { BriefcaseIcon, ShieldIcon, UploadIcon, WalletIcon } from "./icons";

interface AnimatedStatsProps {
  stats: PublicStats;
}

export function AnimatedStats({ stats }: AnimatedStatsProps) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface/80 backdrop-blur-md">
      {/* Subtle ambient light bar */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-32 w-full max-w-5xl -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        {/* Network status ticker */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 text-[11px] text-fg-subtle">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono uppercase tracking-wider text-fg-muted">
              Solana Cluster Active
            </span>
            <span className="text-border-strong">|</span>
            <span className="font-mono text-accent">Devnet ~400ms finality</span>
          </div>

          <div className="hidden items-center gap-4 font-mono sm:flex">
            <span className="flex items-center gap-1.5">
              <ShieldIcon size={12} className="text-accent" />
              Non-custodial Escrow
            </span>
            <span className="text-border-strong">·</span>
            <span>Audited Anchor Program</span>
          </div>
        </div>

        {/* 4 Interactive Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<UploadIcon size={20} />}
            label="Published sessions"
            numericValue={stats.publishedVideos}
            suffix=""
            subtext="Verified timelapse sessions"
            badge="100% on-record"
            delay={0}
          />
          <StatCard
            icon={<CodeNodeIcon />}
            label="Builders"
            numericValue={stats.users}
            suffix=""
            subtext="Shipping with public proof"
            badge="Active creators"
            delay={100}
          />
          <StatCard
            icon={<BriefcaseIcon size={20} />}
            label="Open roles"
            numericValue={stats.openJobs}
            suffix=""
            subtext="Milestone escrow funded"
            badge="Direct hire"
            delay={200}
          />
          <StatCard
            icon={<WalletIcon size={20} />}
            label="Sponsored on-chain"
            numericValue={stats.sponsorTotalLamports / 1_000_000_000}
            suffix=" SOL"
            decimals={stats.sponsorTotalLamports > 0 ? 2 : 0}
            subtext="Direct wallet settlement"
            badge="Anchor verified"
            delay={300}
            isSol
          />
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  numericValue: number;
  suffix?: string;
  decimals?: number;
  subtext: string;
  badge: string;
  delay?: number;
  isSol?: boolean;
}

function StatCard({
  icon,
  label,
  numericValue,
  suffix = "",
  decimals = 0,
  subtext,
  badge,
  delay = 0,
  isSol = false,
}: StatCardProps) {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, active: false });

  // Number count-up animation
  useEffect(() => {
    setMounted(true);
    const duration = 1200; // ms
    let startTime: number | null = null;
    let animationFrame: number;

    const timeout = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // easeOutExpo
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(numericValue * easeProgress);

        if (progress < 1) {
          animationFrame = requestAnimationFrame(step);
        } else {
          setCount(numericValue);
        }
      };
      animationFrame = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [numericValue, delay]);

  // Spotlight mouse tracker
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setMousePos((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-5
                 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/40
                 hover:shadow-[var(--shadow-raised)]"
    >
      {/* Interactive cursor-following spotlight glow */}
      {mousePos.active && (
        <div
          className="pointer-events-none absolute -inset-px rounded-[var(--radius-card)] opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(220px circle at ${mousePos.x}px ${mousePos.y}px, var(--color-accent-soft), transparent 80%)`,
          }}
          aria-hidden
        />
      )}

      {/* Top row: Icon & Tag */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <span className="rounded-full border border-border/80 bg-bg px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-fg-subtle group-hover:border-accent/30 group-hover:text-accent">
          {badge}
        </span>
      </div>

      {/* Metric value with count-up animation */}
      <div className="relative z-10 mt-4">
        <dt className="text-[12px] font-medium tracking-wide uppercase text-fg-subtle">
          {label}
        </dt>
        <dd className="mt-1.5 flex items-baseline gap-1">
          <span className="text-[30px] font-bold tracking-tight text-fg tabular-nums leading-none">
            {mounted ? (
              decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString()
            ) : (
              numericValue
            )}
          </span>
          {suffix && (
            <span className={`text-[15px] font-semibold ${isSol ? "text-accent font-mono" : "text-fg-muted"}`}>
              {suffix}
            </span>
          )}
        </dd>
        <p className="mt-2 text-[12px] text-fg-muted transition-colors group-hover:text-fg">
          {subtext}
        </p>
      </div>

      {/* Bottom glowing accent line on hover */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-accent to-emerald-400
                   transition-all duration-300 group-hover:w-full"
        aria-hidden
      />
    </div>
  );
}

function CodeNodeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
