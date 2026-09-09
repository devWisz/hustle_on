"use client";

import { useState } from "react";
import { Card, Badge, ButtonLink } from "./ui";
import {
  ClockIcon,
  SolanaIcon,
  ArrowRightIcon,
  UploadIcon,
} from "./icons";

interface StackTier {
  id: string;
  name: string;
  badge: string;
  rateUsdPerHour: number;
  rateSolPerHour: number;
  baseBountySol: number;
}

const STACK_TIERS: StackTier[] = [
  {
    id: "solana-rust",
    name: "Solana & Rust Core",
    badge: "High Leverage",
    rateUsdPerHour: 140,
    rateSolPerHour: 0.95,
    baseBountySol: 0.75,
  },
  {
    id: "smart-contracts",
    name: "Smart Contract Audit",
    badge: "Security",
    rateUsdPerHour: 175,
    rateSolPerHour: 1.2,
    baseBountySol: 1.25,
  },
  {
    id: "fullstack-go",
    name: "Full-Stack Go / Next.js",
    badge: "Production",
    rateUsdPerHour: 110,
    rateSolPerHour: 0.75,
    baseBountySol: 0.5,
  },
  {
    id: "systems-3d",
    name: "3D & WebGL Engine",
    badge: "Graphics",
    rateUsdPerHour: 95,
    rateSolPerHour: 0.65,
    baseBountySol: 0.4,
  },
];

const SPEED_PRESETS = [
  { label: "8x", factor: 8, desc: "Quick reviews" },
  { label: "16x", factor: 16, desc: "Recommended" },
  { label: "32x", factor: 32, desc: "Dense sprints" },
  { label: "64x", factor: 64, desc: "Ultra compressed" },
];

export function PayoutCalculator() {
  const [hours, setHours] = useState<number>(8);
  const [selectedStackId, setSelectedStackId] = useState<string>("solana-rust");
  const [speedFactor, setSpeedFactor] = useState<number>(16);

  const selectedTier: StackTier =
    STACK_TIERS.find((t) => t.id === selectedStackId) ?? (STACK_TIERS[0] as StackTier);

  // Calculated Metrics
  const milestoneUsd = hours * selectedTier.rateUsdPerHour;
  const milestoneSol = Number((hours * selectedTier.rateSolPerHour).toFixed(2));
  const verificationBountySol = selectedTier.baseBountySol;
  const totalSol = Number((milestoneSol + verificationBountySol).toFixed(2));

  // Video compression telemetry
  const totalMinutes = hours * 60;
  const videoMinutes = Math.max(1, Math.round(totalMinutes / speedFactor));
  const estimatedFrames = hours * 1800; // 1 frame every 2 seconds
  const estimatedSizeMb = Math.round(videoMinutes * 18.5); // ~18.5MB per min of high-bitrate 1080p timelapse

  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Controls */}
        <div className="space-y-6 lg:col-span-7">
          {/* Stack Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
              1. Engineering Discipline & Stack
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STACK_TIERS.map((tier) => {
                const isSelected = tier.id === selectedTier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedStackId(tier.id)}
                    className={`flex flex-col text-left p-3.5 rounded-[var(--radius-control)] border transition-all ${
                      isSelected
                        ? "border-accent bg-accent-soft/40 shadow-sm"
                        : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-fg">{tier.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-fg-subtle">
                        {tier.badge}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold text-fg">
                        ${tier.rateUsdPerHour}/hr
                      </span>
                      <span className="font-mono text-[11px] text-fg-muted">
                        (~{tier.rateSolPerHour} SOL)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Work Hours Slider */}
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="duration-slider" className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                2. Continuous Work Session Length
              </label>
              <div className="flex items-center gap-1.5 font-mono text-base font-bold text-fg">
                <ClockIcon size={16} className="text-accent" />
                <span>{hours} Hours</span>
                <span className="text-xs font-normal text-fg-muted">({hours * 60} mins)</span>
              </div>
            </div>

            <input
              id="duration-slider"
              type="range"
              min="1"
              max="40"
              step="1"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-raised accent-accent"
            />

            {/* Quick Hours Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-fg-subtle">Presets:</span>
              {[
                { h: 4, label: "4h Sprint" },
                { h: 8, label: "8h Full Day" },
                { h: 16, label: "16h Ship" },
                { h: 40, label: "40h Audit" },
              ].map((p) => (
                <button
                  key={p.h}
                  type="button"
                  onClick={() => setHours(p.h)}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    hours === p.h
                      ? "border-accent bg-accent text-accent-fg font-medium"
                      : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timelapse Compression Ratio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
              3. Timelapse Playback Compression Rate
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SPEED_PRESETS.map((p) => {
                const isSelected = speedFactor === p.factor;
                return (
                  <button
                    key={p.factor}
                    type="button"
                    onClick={() => setSpeedFactor(p.factor)}
                    className={`p-2.5 text-center rounded-[var(--radius-control)] border transition-all ${
                      isSelected
                        ? "border-accent bg-accent-soft text-accent font-semibold"
                        : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
                    }`}
                  >
                    <div className="font-mono text-sm font-bold">{p.label}</div>
                    <div className="text-[10px] text-fg-subtle truncate mt-0.5">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Calculated Value & On-Chain Breakdown */}
        <div className="lg:col-span-5">
          <Card className="p-6 h-full flex flex-col justify-between border-border bg-surface shadow-sm">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
                  <SolanaIcon size={15} />
                  <span>On-Chain Settlement Estimate</span>
                </div>
                <Badge tone="accent">Verifiable Proof</Badge>
              </div>

              {/* Primary Payout Figure */}
              <div className="mt-5">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">
                  Total Developer Compensation
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
                    {totalSol} SOL
                  </span>
                  <span className="font-mono text-base font-medium text-fg-muted">
                    ~${(milestoneUsd + verificationBountySol * 150).toLocaleString()} USD
                  </span>
                </div>
              </div>

              {/* Breakdown Ledger */}
              <div className="mt-6 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-raised p-4 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-fg-muted">Milestone Escrow Rate ({hours}h)</span>
                  <span className="font-semibold text-fg">{milestoneSol} SOL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fg-muted">Verified Listing Bounty</span>
                  <span className="font-semibold text-accent">+{verificationBountySol} SOL</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-fg-subtle">Anchor Escrow PDA Lock</span>
                  <span className="text-fg-subtle font-mono">Non-custodial</span>
                </div>
              </div>

              {/* Cryptographic Proof Telemetry */}
              <div className="mt-5 space-y-2 text-xs">
                <p className="font-semibold text-fg text-[12px]">Session Telemetry & Merkle Leaves:</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-fg-muted">
                  <div className="rounded border border-border bg-surface p-2">
                    <span className="block text-fg-subtle">Recorded Frames</span>
                    <span className="font-mono font-semibold text-fg">
                      {estimatedFrames.toLocaleString()} frames
                    </span>
                  </div>
                  <div className="rounded border border-border bg-surface p-2">
                    <span className="block text-fg-subtle">Review Duration</span>
                    <span className="font-mono font-semibold text-fg">
                      {videoMinutes} mins @ {speedFactor}x
                    </span>
                  </div>
                  <div className="rounded border border-border bg-surface p-2">
                    <span className="block text-fg-subtle">Estimated Size</span>
                    <span className="font-mono font-semibold text-fg">~{estimatedSizeMb} MB (1080p)</span>
                  </div>
                  <div className="rounded border border-border bg-surface p-2">
                    <span className="block text-fg-subtle">Hash Attestation</span>
                    <span className="font-mono font-semibold text-accent">SHA-256 Merkle</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Action CTAs */}
            <div className="mt-6 pt-5 border-t border-border flex flex-col gap-2.5">
              <ButtonLink href="/upload" size="md" className="w-full justify-center">
                <UploadIcon size={16} />
                Upload Timelapse & Claim Bounty
              </ButtonLink>
              <ButtonLink href="/hire/proposal" variant="secondary" size="md" className="w-full justify-center">
                Lock Milestone Escrow for Talent
                <ArrowRightIcon size={14} />
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
