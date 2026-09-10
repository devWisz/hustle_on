"use client";

import { useState, useEffect } from "react";
import { CheckIcon, ShieldIcon } from "./icons";

interface DemoDonation {
  id: number;
  name: string;
  action: string;
  amount: string;
  time: string;
}

const DEMO_DONATIONS: DemoDonation[] = [
  { id: 1, name: "@sarjak", action: "Building Next.js 15 App Shell", amount: "1.5 SOL", time: "2m ago" },
  { id: 2, name: "@alex_code", action: "Refactoring Go Auth Engine", amount: "0.8 SOL", time: "8m ago" },
  { id: 3, name: "@dev_sam", action: "Solana Wallet Verification", amount: "2.4 SOL", time: "15m ago" },
];

export function HeroVisual() {
  const [speed, setSpeed] = useState<"1x" | "4x" | "16x" | "64x">("16x");
  const [activeDonation, setActiveDonation] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDonation((prev) => (prev + 1) % DEMO_DONATIONS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const current: DemoDonation = DEMO_DONATIONS[activeDonation] ?? DEMO_DONATIONS[0]!;

  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      {/* Glow effect under card */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-accent/20 via-primary/20 to-accent/10 blur-xl opacity-75 group-hover:opacity-100 transition duration-1000"></div>

      <div className="relative rounded-[var(--radius-panel)] border border-border/80 bg-surface/90 backdrop-blur-xl p-5 shadow-2xl">
        {/* Top bar header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-xs font-medium tracking-wide uppercase text-fg-muted">Recorded Session</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent border border-accent/20">
            <ShieldIcon size={12} />
            Human Reviewed
          </div>
        </div>

        {/* Video / Code Player Mockup */}
        <div className="mt-4 relative rounded-xl bg-slate-950 border border-slate-800/80 p-4 font-mono text-xs overflow-hidden shadow-inner min-h-[190px]">
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800/60 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              <span className="ml-2 text-slate-300 font-sans font-medium truncate max-w-[170px] sm:max-w-[220px]">
                sardhana/frontend/src/app/page.tsx
              </span>
            </div>
            <span className="text-accent font-semibold">{speed} Speed</span>
          </div>

          <div className="space-y-1.5 text-slate-300">
            <div className="flex gap-3">
              <span className="text-slate-600 select-none">01</span>
              <span><span className="text-purple-400">export async function</span> <span className="text-blue-300 font-semibold">PublishWork</span>() {'{'}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none">02</span>
              <span className="pl-4"><span className="text-purple-400">const</span> proof = <span className="text-purple-400">await</span> auditReview();</span>
            </div>
            <div className="flex gap-3 bg-accent/15 -mx-4 px-4 py-1 border-l-2 border-accent">
              <span className="text-slate-500 select-none">03</span>
              <span className="text-emerald-300"><span className="text-purple-400">return</span> &lt;<span className="text-amber-300 font-semibold">SolanaDirectTransfer</span> wallet={'{proof.wallet}'} /&gt;;</span>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none">04</span>
              <span>{'}'}</span>
            </div>
          </div>

          {/* Speed selector controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-900/90 border border-slate-700/60 rounded-lg p-1">
            {(["1x", "4x", "16x", "64x"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition ${
                  speed === s ? "bg-accent text-white font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Live Donation Feed Card */}
        <div className="mt-4 rounded-xl border border-border/80 bg-surface/70 p-3.5 flex items-center justify-between transition-all duration-500">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0">
              SOL
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg">{current.name}</span>
                <span className="text-[10px] text-fg-muted">• {current.time}</span>
              </div>
              <p className="text-[11px] text-fg-muted truncate max-w-[150px] sm:max-w-[200px]">
                {current.action}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-accent">
              +{current.amount}
            </div>
            <span className="text-[10px] text-emerald-500 font-medium flex items-center justify-end gap-0.5">
              <CheckIcon size={10} /> Direct Payout
            </span>
          </div>
        </div>

        {/* Bottom stats badges */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg border border-border/60 bg-surface/40 p-2">
            <div className="font-semibold text-fg">100%</div>
            <div className="text-[10px] text-fg-muted">Human Audited</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/40 p-2">
            <div className="font-semibold text-fg">0%</div>
            <div className="text-[10px] text-fg-muted">Platform Cut</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/40 p-2">
            <div className="font-semibold text-accent">Instant</div>
            <div className="text-[10px] text-fg-muted">SOL Transfers</div>
          </div>
        </div>
      </div>
    </div>
  );
}
