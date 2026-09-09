"use client";

import { useState } from "react";
import { Container, Card, Badge, ButtonLink, Stat } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

interface MilestoneEngagement {
  id: string;
  talent: { handle: string; displayName: string };
  projectTitle: string;
  totalBudgetSol: number;
  escrowPda: string;
  milestones: {
    title: string;
    amountSol: number;
    proofVideoTitle?: string;
    proofDuration?: string;
    status: "released" | "awaiting_approval" | "in_progress";
  }[];
  startedAt: string;
}

const MOCK_ENGAGEMENTS: MilestoneEngagement[] = [
  {
    id: "ENG-8021",
    talent: { handle: "alex_vance", displayName: "Alex Vance" },
    projectTitle: "Build Sub-millisecond Order Matching Engine in Rust",
    totalBudgetSol: 25.0,
    escrowPda: "4mK8pQ2Y9x8Z7vW1aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7h",
    startedAt: "2026-09-01T00:00:00Z",
    milestones: [
      {
        title: "Milestone 1: Core Lock-Free Queue & Memory Ring Buffer",
        amountSol: 8.0,
        proofVideoTitle: "Ring Buffer Implementation & Benchmarks (4h 15m)",
        proofDuration: "3m 50s",
        status: "released",
      },
      {
        title: "Milestone 2: Multi-threaded Matching Engine & Unit Tests",
        amountSol: 10.0,
        proofVideoTitle: "Matching Engine Core & High-concurrency Testing (5h 30m)",
        proofDuration: "4m 20s",
        status: "awaiting_approval",
      },
      {
        title: "Milestone 3: Performance Fuzzing & C API Bindings",
        amountSol: 7.0,
        status: "in_progress",
      },
    ],
  },
];

export default function ClientEscrowDashboardPage() {
  const [engagements, setEngagements] = useState<MilestoneEngagement[]>(MOCK_ENGAGEMENTS);
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);

  const handleRelease = (engId: string, milestoneIndex: number, amount: number) => {
    setEngagements((prev) =>
      prev.map((eng) => {
        if (eng.id !== engId) return eng;
        return {
          ...eng,
          milestones: eng.milestones.map((m, idx) =>
            idx === milestoneIndex ? { ...m, status: "released" } : m
          ),
        };
      })
    );
    setReleaseMsg(`✓ Escrow release authorized. Transferred ${amount} SOL to talent wallet via Solana Anchor program.`);
    setTimeout(() => setReleaseMsg(null), 5000);
  };

  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">Hiring Perspective</Badge>
            <span className="text-xs font-mono text-fg-subtle">MILESTONE ESCROW MANAGER</span>
          </div>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-fg sm:text-[32px]">
            Client Hiring & Escrow Dashboard
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Inspect delivered milestone timelapses and release locked escrow payments directly to builders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ButtonLink href="/hire" variant="secondary">
            Browse Talent Catalog
          </ButtonLink>
          <ButtonLink href="/jobs/new">
            Post New Role
          </ButtonLink>
        </div>
      </div>

      {releaseMsg && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-accent/40 bg-accent-soft p-4 text-[13px] font-medium text-accent">
          {releaseMsg}
        </div>
      )}

      {/* Escrow Metrics */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <Stat label="Total Escrow Deposited" value="25.00 SOL" hint="Locked in Anchor PDA" />
        </Card>
        <Card className="p-5">
          <Stat label="Released Upon Proof" value="18.00 SOL" hint="Milestones settled" />
        </Card>
        <Card className="p-5">
          <Stat label="Pending Deliverables" value="1 milestone" hint="Awaiting client sign-off" />
        </Card>
        <Card className="p-5">
          <Stat label="Active Engagements" value="1 contract" hint="In progress" />
        </Card>
      </div>

      {/* Active Contracts & Deliverables Review */}
      <div className="mt-10 space-y-6">
        <h2 className="text-[18px] font-semibold text-fg">Active Milestone Contracts</h2>

        {engagements.map((eng) => (
          <Card key={eng.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="font-mono text-xs text-fg-subtle">{eng.id}</span>
                <h3 className="mt-1 text-[18px] font-semibold text-fg">{eng.projectTitle}</h3>
                <p className="mt-0.5 text-xs text-fg-muted font-mono">
                  Hired: @{eng.talent.handle} ({eng.talent.displayName}) · Escrow PDA:{" "}
                  {eng.escrowPda.slice(0, 10)}...{eng.escrowPda.slice(-6)}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-fg-subtle">Total Escrow Budget:</span>
                <p className="font-mono text-base font-bold text-accent">{eng.totalBudgetSol} SOL</p>
              </div>
            </div>

            {/* Milestones List */}
            <div className="mt-6 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Contract Milestones & Deliverables
              </h4>

              {eng.milestones.map((m, idx) => (
                <div
                  key={m.title}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[var(--radius-control)] border border-border bg-surface-raised p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-fg">0{idx + 1}</span>
                      <p className="font-medium text-sm text-fg truncate">{m.title}</p>
                    </div>

                    {m.proofVideoTitle && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-accent">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft">
                          <CheckIcon size={10} />
                        </span>
                        <span>Delivered Proof: {m.proofVideoTitle}</span>
                        <span className="font-mono text-fg-subtle">({m.proofDuration})</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm font-semibold text-fg">{m.amountSol} SOL</span>

                    {m.status === "released" && (
                      <Badge tone="accent">Funds Released</Badge>
                    )}

                    {m.status === "awaiting_approval" && (
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">Ready to Inspect</Badge>
                        <button
                          onClick={() => handleRelease(eng.id, idx, m.amountSol)}
                          className="rounded-[var(--radius-control)] bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                        >
                          Approve Proof & Release Escrow
                        </button>
                      </div>
                    )}

                    {m.status === "in_progress" && (
                      <Badge tone="neutral">Work In Progress</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
