"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Container, Card, Button, Input, Textarea, Badge } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

export default function HireProposalPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-fg-muted">Loading proposal builder...</div>}>
      <ProposalBuilder />
    </Suspense>
  );
}

function ProposalBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const talentHandle = searchParams.get("talent") || "alex_vance";

  const [projectTitle, setProjectTitle] = useState("");
  const [projectScope, setProjectScope] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState("3");
  const [milestones, setMilestones] = useState([
    { title: "Milestone 1: Architecture RFC & Core Engine POC", amountSol: 6.0 },
    { title: "Milestone 2: Feature Implementation & Verification Tests", amountSol: 8.0 },
    { title: "Milestone 3: Final Delivery & Documented Timelapse Proof", amountSol: 6.0 },
  ]);
  const [requireTimelapseProof, setRequireTimelapseProof] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const totalSol = milestones.reduce((sum, m) => sum + (Number(m.amountSol) || 0), 0);

  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Container width="narrow" className="py-16 sm:py-24">
        <Card className="p-8 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckIcon size={24} />
          </div>
          <h2 className="mt-4 text-[22px] font-bold text-fg">Milestone Proposal Dispatched</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted leading-relaxed">
            Your proposal has been sent to <strong>@{talentHandle}</strong>. Once they accept, you can
            fund the on-chain Anchor escrow account with {totalSol} SOL to start the project.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/hire/dashboard"
              className="rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover"
            >
              Go to Escrow Dashboard
            </Link>
            <Link
              href="/hire"
              className="rounded-[var(--radius-control)] border border-border bg-surface px-5 py-2 text-sm font-medium text-fg hover:bg-surface-raised"
            >
              Browse More Talent
            </Link>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <Badge tone="accent">Talent Acquisition POV</Badge>
          <span className="text-xs font-mono text-fg-subtle">PROPOSAL BUILDER</span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold tracking-tight text-fg sm:text-[32px]">
          Hire @{talentHandle}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Structure a milestone-based engagement backed by verified timelapse deliverables.
        </p>
      </header>

      <form onSubmit={handleSubmitProposal} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">Project Title</label>
            <Input
              required
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="e.g. Develop High-performance Solana Indexer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">Scope & Deliverables</label>
            <Textarea
              required
              rows={4}
              value={projectScope}
              onChange={(e) => setProjectScope(e.target.value)}
              placeholder="Outline what needs to be built, expected technical stack, and acceptance criteria."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">Estimated Timeline (Weeks)</label>
            <Input
              type="number"
              min="1"
              max="24"
              value={timelineWeeks}
              onChange={(e) => setTimelineWeeks(e.target.value)}
            />
          </div>
        </Card>

        {/* Milestones Configurator */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Milestone Escrow Schedule</h3>
            <span className="font-mono text-xs font-bold text-accent">Total: {totalSol} SOL</span>
          </div>

          <div className="space-y-3">
            {milestones.map((m, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-surface-raised p-3"
              >
                <span className="font-mono text-xs text-fg-subtle font-semibold">0{index + 1}</span>
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMilestones((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, title: val } : item))
                    );
                  }}
                  className="flex-1 bg-transparent text-xs text-fg focus:outline-none"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    value={m.amountSol}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setMilestones((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, amountSol: val } : item))
                      );
                    }}
                    className="w-16 h-7 rounded border border-border bg-surface px-1.5 text-xs font-mono font-semibold"
                  />
                  <span className="text-[11px] font-mono text-fg-subtle">SOL</span>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 pt-2 text-xs text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={requireTimelapseProof}
              onChange={(e) => setRequireTimelapseProof(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Require recorded timelapse proof for each milestone release</span>
          </label>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!projectTitle.trim() || !projectScope.trim()}>
            Send Milestone Proposal
            <ArrowRightIcon size={16} />
          </Button>
        </div>
      </form>
    </Container>
  );
}
