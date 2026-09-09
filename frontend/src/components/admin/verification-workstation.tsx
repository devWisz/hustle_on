"use client";

import { useState } from "react";
import { Card, Button, Badge, Input, Textarea } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

export interface QueueItem {
  id: string;
  title: string;
  creator: {
    handle: string;
    displayName: string;
    wallet: string;
    avatarUrl?: string;
  };
  category: string;
  realHours: number;
  timelapseMinutes: number;
  speedRatio: number;
  gitRepoUrl: string;
  gitCommit: string;
  deliverableUrl: string;
  submittedAt: string;
  status: "pending_verification" | "in_review" | "approved" | "rejected" | "revision_requested";
  bountyTargetSol: number;
  previewSnippet: string;
}

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: "SUB-849204",
    title: "Rust Write-Ahead Log Engine & Concurrency Benchmarks",
    creator: {
      handle: "alex_vance",
      displayName: "Alex Vance",
      wallet: "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG",
    },
    category: "Software & Systems Engineering",
    realHours: 6.5,
    timelapseMinutes: 4.2,
    speedRatio: 45,
    gitRepoUrl: "https://github.com/alexvance/wal-engine/pull/14",
    gitCommit: "9b3d1f8a2c",
    deliverableUrl: "https://crates.io/crates/wal-engine",
    submittedAt: "2026-09-09T10:15:00Z",
    status: "pending_verification",
    bountyTargetSol: 1.5,
    previewSnippet: "pub fn write_batch(&mut self, records: &[Record]) -> Result<u64> {\n  let offset = self.file.seek(SeekFrom::End(0))?;\n  self.encoder.encode_to(&mut self.file, records)?;\n  Ok(offset)\n}",
  },
  {
    id: "SUB-849205",
    title: "Anchor Solana Vault Program with Milestone Escrow",
    creator: {
      handle: "elena_sol",
      displayName: "Elena Rostova",
      wallet: "4mK8pQ2Y9x8Z7vW1aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7h",
    },
    category: "Smart Contracts & Solana / Anchor",
    realHours: 5.0,
    timelapseMinutes: 3.8,
    speedRatio: 40,
    gitRepoUrl: "https://github.com/elena-sol/escrow-vault",
    gitCommit: "4e710ca8b",
    deliverableUrl: "https://explorer.solana.com/address/escrowProgramId?cluster=devnet",
    submittedAt: "2026-09-09T11:45:00Z",
    status: "pending_verification",
    bountyTargetSol: 1.25,
    previewSnippet: "#[derive(Accounts)]\npub struct ReleaseMilestone<'info> {\n  #[account(mut, has_one = client)]\n  pub engagement: Account<'info, Engagement>,\n  pub talent: SystemAccount<'info>,\n}",
  },
  {
    id: "SUB-849206",
    title: "Full Figma Design System & Micro-Interactions for Web3 Banking",
    creator: {
      handle: "sarah_ui",
      displayName: "Sarah Jenkins",
      wallet: "9pZ5Y7hN8kM9qX2K8yG4pZ5Y7hN8kM9qX2K8yG4pZ5Y7",
    },
    category: "UI/UX Product Design & Figma",
    realHours: 4.0,
    timelapseMinutes: 3.2,
    speedRatio: 30,
    gitRepoUrl: "",
    gitCommit: "",
    deliverableUrl: "https://www.figma.com/community/file/12948201",
    submittedAt: "2026-09-09T13:10:00Z",
    status: "pending_verification",
    bountyTargetSol: 1.0,
    previewSnippet: "Design tokens: --color-primary-500: #10b981;\nTypography scale: 12px, 14px, 16px, 20px, 28px, 36px;\nComponents: 42 variants with component properties & variants",
  },
];

export function VerificationWorkstation() {
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_QUEUE[0]?.id ?? "");
  const [activePlaybackSpeed, setActivePlaybackSpeed] = useState<number>(1);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Checklist State for Active Item
  const [checkScreenActivity, setCheckScreenActivity] = useState(true);
  const [checkProofMatch, setCheckProofMatch] = useState(true);
  const [checkSecretScan, setCheckSecretScan] = useState(true);
  const [checkFramerateQuality, setCheckFramerateQuality] = useState(true);

  // Review Form
  const [bountyAwardSol, setBountyAwardSol] = useState("1.5");
  const [moderatorFeedback, setModeratorFeedback] = useState("");
  const [rejectionReason, setRejectionReason] = useState("static_screen_inactivity");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const activeItem = queue.find((q) => q.id === selectedId) || queue[0];

  const handleApproveAndList = () => {
    if (!activeItem) return;
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id ? { ...item, status: "approved" } : item
      )
    );
    setActionSuccessMsg(
      `✓ Approved "${activeItem.title}". Listed in public catalog and disbursed ${bountyAwardSol} SOL bounty to @${activeItem.creator.handle}!`
    );
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  const handleReject = () => {
    if (!activeItem) return;
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id ? { ...item, status: "rejected" } : item
      )
    );
    setActionSuccessMsg(
      `Submission ${activeItem.id} rejected (${rejectionReason}). Feedback sent to creator.`
    );
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  const handleRequestRevision = () => {
    if (!activeItem) return;
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id ? { ...item, status: "revision_requested" } : item
      )
    );
    setActionSuccessMsg(
      `Revision requested for ${activeItem.id}. Creator notified to update proof.`
    );
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  const filteredQueue = queue.filter((item) => {
    if (filter === "pending") return item.status === "pending_verification" || item.status === "in_review";
    if (filter === "approved") return item.status === "approved";
    if (filter === "rejected") return item.status === "rejected" || item.status === "revision_requested";
    return true;
  });

  const pendingCount = queue.filter(
    (q) => q.status === "pending_verification" || q.status === "in_review"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Moderation Stats Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-[12px] font-medium text-fg-subtle">Pending in Queue</span>
          <p className="mt-1 text-[24px] font-bold text-fg tabular-nums">{pendingCount}</p>
          <span className="text-[11px] text-accent">~35m avg turnaround</span>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-fg-subtle">Approved Today</span>
          <p className="mt-1 text-[24px] font-bold text-fg tabular-nums">14 sessions</p>
          <span className="text-[11px] text-fg-muted">94.5% pass rate</span>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-fg-subtle">Bounties Disbursed</span>
          <p className="mt-1 text-[24px] font-bold text-accent tabular-nums">21.50 SOL</p>
          <span className="text-[11px] text-fg-muted">~$3,225 USD</span>
        </Card>
        <Card className="p-4">
          <span className="text-[12px] font-medium text-fg-subtle">Flagged / Rejected</span>
          <p className="mt-1 text-[24px] font-bold text-danger tabular-nums">1 session</p>
          <span className="text-[11px] text-fg-muted">Static screen loop</span>
        </Card>
      </div>

      {actionSuccessMsg && (
        <div className="rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4 text-[13px] font-medium text-accent">
          {actionSuccessMsg}
        </div>
      )}

      {/* Main Review Deck */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Queue Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-fg">Verification Queue</h3>
            <div className="flex gap-1 text-[11px]">
              {(["pending", "approved", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`rounded px-2 py-0.5 capitalize transition-colors ${
                    filter === t
                      ? "bg-surface-raised font-semibold text-fg border border-border"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredQueue.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`cursor-pointer rounded-[var(--radius-card)] border p-3.5 transition-all ${
                  selectedId === item.id
                    ? "border-accent bg-surface-raised shadow-[var(--shadow-card)]"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-fg-subtle">{item.id}</span>
                  <Badge
                    tone={
                      item.status === "approved"
                        ? "accent"
                        : item.status === "rejected"
                        ? "danger"
                        : "neutral"
                    }
                  >
                    {item.status.replace("_", " ")}
                  </Badge>
                </div>
                <h4 className="mt-1.5 text-[13px] font-medium text-fg line-clamp-1">{item.title}</h4>
                <p className="mt-1 text-[11px] text-fg-muted font-mono">
                  @{item.creator.handle} · {item.realHours}h work ({item.speedRatio}x)
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detailed Inspection Workstation */}
        {activeItem && (
          <div className="lg:col-span-8 space-y-6">
            <Card className="p-6">
              {/* Header Details */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-accent">{activeItem.id}</span>
                    <span className="text-border-strong">·</span>
                    <span className="text-xs text-fg-muted">{activeItem.category}</span>
                  </div>
                  <h2 className="mt-1 text-[19px] font-bold text-fg">{activeItem.title}</h2>
                  <p className="mt-1 text-xs text-fg-muted font-mono">
                    Creator: @{activeItem.creator.handle} ({activeItem.creator.displayName}) · Wallet:{" "}
                    {activeItem.creator.wallet.slice(0, 8)}...{activeItem.creator.wallet.slice(-6)}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-fg-subtle">Claimed Real Work:</span>
                  <p className="font-semibold text-sm text-fg">
                    {activeItem.realHours} hours ({activeItem.timelapseMinutes}m timelapse @ {activeItem.speedRatio}x)
                  </p>
                </div>
              </div>

              {/* Video Inspection Simulation Player */}
              <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-neutral-950 p-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs text-neutral-400">
                  <span className="font-mono">TIMELAPSE SCRUBBER · 1080p @ 60FPS</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>SCRUB SPEED:</span>
                    {[1, 2, 5, 10].map((s) => (
                      <button
                        key={s}
                        onClick={() => setActivePlaybackSpeed(s)}
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          activePlaybackSpeed === s
                            ? "bg-accent text-accent-fg font-bold"
                            : "bg-white/10 text-neutral-300 hover:bg-white/20"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Screen Stream Snippet */}
                <div className="my-4 rounded border border-white/10 bg-neutral-900/80 p-3 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
                  <p className="text-[11px] text-neutral-500 mb-1">{"// Active Recorded Code Frame"}</p>
                  <pre>{activeItem.previewSnippet}</pre>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 border-t border-white/10 pt-2 font-mono">
                  <span>Frame: 04:12 / 04:12</span>
                  <span className="text-emerald-400">No static screen freeze detected</span>
                </div>
              </div>

              {/* Proof Artifact Verification Section */}
              <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface-raised p-4 text-[13px] space-y-2">
                <h4 className="font-semibold text-fg">Verifiable Proof Artifacts</h4>
                <div className="grid gap-2 text-xs font-mono">
                  {activeItem.gitRepoUrl ? (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-subtle">VCS Repository / PR:</span>
                      <a
                        href={activeItem.gitRepoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline hover:text-accent-hover truncate max-w-sm"
                      >
                        {activeItem.gitRepoUrl}
                      </a>
                    </div>
                  ) : null}

                  {activeItem.gitCommit ? (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-subtle">Target Commit SHA:</span>
                      <span className="text-fg font-semibold">{activeItem.gitCommit}</span>
                    </div>
                  ) : null}

                  {activeItem.deliverableUrl ? (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-subtle">Live / Staging Artifact:</span>
                      <a
                        href={activeItem.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline hover:text-accent-hover truncate max-w-sm"
                      >
                        {activeItem.deliverableUrl}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Moderator Checklist */}
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-fg">Manual Verification Checklist</h4>
                <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkScreenActivity}
                      onChange={(e) => setCheckScreenActivity(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>1. Continuous screen activity verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkProofMatch}
                      onChange={(e) => setCheckProofMatch(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>2. Code matches Git commits/PR</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkSecretScan}
                      onChange={(e) => setCheckSecretScan(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>3. Clean credential & secret scan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkFramerateQuality}
                      onChange={(e) => setCheckFramerateQuality(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>4. 1080p+ framerate pacing compliant</span>
                  </label>
                </div>
              </div>

              {/* Moderator Notes & Feedback */}
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg">Moderator Feedback / Notes:</span>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-fg-muted"
                  >
                    <option value="static_screen_inactivity">Canned Reason: Inactive / Static Screen</option>
                    <option value="insufficient_proof_artifacts">Canned Reason: Incomplete Git Proof</option>
                    <option value="sensitive_data_exposed">Canned Reason: Secret / Key Leak Detected</option>
                  </select>
                </div>
                <Textarea
                  rows={2}
                  value={moderatorFeedback}
                  onChange={(e) => setModeratorFeedback(e.target.value)}
                  placeholder="Optional review notes sent to the creator..."
                  className="text-xs"
                />
              </div>

              {/* Bounty Reward & Action Buttons */}
              <div className="mt-5 border-t border-border pt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-fg">Bounty to Award:</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.25"
                        value={bountyAwardSol}
                        onChange={(e) => setBountyAwardSol(e.target.value)}
                        className="w-24 h-8 text-xs font-mono font-bold"
                      />
                      <span className="text-xs font-mono text-fg-subtle">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="danger" size="sm" onClick={handleReject}>
                      Reject
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleRequestRevision}>
                      Request Revision
                    </Button>
                    <Button size="sm" onClick={handleApproveAndList}>
                      <CheckIcon size={14} />
                      Approve & List on Site
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
