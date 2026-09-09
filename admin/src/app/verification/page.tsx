"use client";

import { useState } from "react";
import { Badge, Button, Card, Stat } from "@/components/ui";

interface AdminQueueItem {
  id: string;
  title: string;
  creator: { handle: string; displayName: string; wallet: string };
  category: string;
  realHours: number;
  timelapseMinutes: number;
  speedRatio: number;
  gitRepoUrl: string;
  gitCommit: string;
  deliverableUrl: string;
  submittedAt: string;
  status: "pending_verification" | "approved" | "rejected" | "revision_requested";
  bountyTargetSol: number;
  previewSnippet: string;
}

const INITIAL_QUEUE: AdminQueueItem[] = [
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

export default function AdminVerificationQueuePage() {
  const [queue, setQueue] = useState<AdminQueueItem[]>(INITIAL_QUEUE);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_QUEUE[0]?.id ?? "");
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  // Checklist
  const [checkScreen, setCheckScreen] = useState(true);
  const [checkGit, setCheckGit] = useState(true);
  const [checkSecrets, setCheckSecrets] = useState(true);
  const [checkPacing, setCheckPacing] = useState(true);

  // Form
  const [bountySol, setBountySol] = useState("1.5");
  const [notes, setNotes] = useState("");
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const active = queue.find((q) => q.id === selectedId) || queue[0];

  const handleApprove = () => {
    if (!active) return;
    setQueue((prev) =>
      prev.map((item) => (item.id === active.id ? { ...item, status: "approved" } : item))
    );
    setSuccessNotice(
      `✓ Approved & Listed: "${active.title}". Disbursed ${bountySol} SOL bounty to ${active.creator.handle}.`
    );
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleReject = () => {
    if (!active) return;
    setQueue((prev) =>
      prev.map((item) => (item.id === active.id ? { ...item, status: "rejected" } : item))
    );
    setSuccessNotice(`Rejected submission ${active.id}. Feedback registered in audit log.`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const filtered = queue.filter((item) => {
    if (filter === "pending") return item.status === "pending_verification";
    if (filter === "approved") return item.status === "approved";
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Manual Video Verification Queue</h1>
        <p className="mt-1.5 text-[13px] text-fg-muted">
          Inspect submitted timelapses, verify screen continuity, match against git commits, and approve public listings.
        </p>
      </div>

      {/* Metrics */}
      <Card className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Stat label="Waiting Review" value={String(queue.filter((q) => q.status === "pending_verification").length)} />
        <Stat label="Approved Today" value="14" />
        <Stat label="Bounties Paid" value="21.5 SOL" />
        <Stat label="Average Review" value="35m" />
      </Card>

      {successNotice && (
        <div className="rounded-[var(--radius-card)] border border-accent/40 bg-accent-soft p-3.5 text-[13px] text-accent">
          {successNotice}
        </div>
      )}

      {/* Two Column Workbench */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Queue List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold">Submissions</h3>
            <div className="flex gap-1 text-[12px]">
              {(["pending", "approved", "all"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`rounded px-2 py-0.5 capitalize ${
                    filter === tab ? "bg-surface-raised font-medium text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`cursor-pointer rounded-[var(--radius-card)] border p-3 text-[13px] transition-all ${
                  selectedId === item.id
                    ? "border-accent bg-surface-raised font-medium"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-fg-subtle">{item.id}</span>
                  <Badge tone={item.status === "approved" ? "neutral" : "danger"}>
                    {item.status === "approved" ? "Approved" : "Pending"}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-1 font-semibold text-fg">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-fg-muted font-mono">
                  @{item.creator.handle} · {item.realHours}h work ({item.speedRatio}x)
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Review Console */}
        {active && (
          <div className="lg:col-span-8 space-y-5">
            <Card className="p-6">
              <div className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-accent font-semibold">{active.id}</span>
                  <span className="text-xs text-fg-subtle">{active.category}</span>
                </div>
                <h2 className="mt-1 text-[18px] font-bold text-fg">{active.title}</h2>
                <p className="mt-1 text-xs text-fg-muted font-mono">
                  Creator: @{active.creator.handle} · Solana: {active.creator.wallet.slice(0, 10)}...
                </p>
              </div>

              {/* Video Inspection Preview */}
              <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-neutral-950 p-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs text-neutral-400 font-mono">
                  <span>TIMELAPSE PREVIEW · {active.timelapseMinutes}m ({active.speedRatio}x Speed)</span>
                  <span className="text-emerald-400">1080p @ 60fps</span>
                </div>
                <div className="my-3 rounded border border-white/10 bg-neutral-900 p-3 font-mono text-xs text-neutral-300">
                  <pre>{active.previewSnippet}</pre>
                </div>
                <div className="text-[11px] text-neutral-400 flex justify-between font-mono">
                  <span>Continuous Screen Pacing: Normal</span>
                  <span>No Idle Freeze Detected</span>
                </div>
              </div>

              {/* Proof Links */}
              <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface-raised p-3.5 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-fg-subtle">VCS Repo:</span>
                  <a href={active.gitRepoUrl} target="_blank" rel="noreferrer" className="text-accent underline truncate max-w-xs">
                    {active.gitRepoUrl || "Not attached"}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-subtle">Commit SHA:</span>
                  <span className="font-semibold text-fg">{active.gitCommit || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-subtle">Deliverable:</span>
                  <a href={active.deliverableUrl} target="_blank" rel="noreferrer" className="text-accent underline truncate max-w-xs">
                    {active.deliverableUrl || "N/A"}
                  </a>
                </div>
              </div>

              {/* Checklist */}
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase text-fg-subtle tracking-wider">
                  Verification Criteria
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checkScreen} onChange={(e) => setCheckScreen(e.target.checked)} />
                    <span>Screen continuous activity verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checkGit} onChange={(e) => setCheckGit(e.target.checked)} />
                    <span>Code matches VCS commits</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checkSecrets} onChange={(e) => setCheckSecrets(e.target.checked)} />
                    <span>No credential / key leaks</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checkPacing} onChange={(e) => setCheckPacing(e.target.checked)} />
                    <span>Framerate & clarity approved</span>
                  </label>
                </div>
              </div>

              {/* Reviewer Notes */}
              <div className="mt-4 border-t border-border pt-3">
                <label className="block text-xs font-semibold text-fg mb-1">
                  Internal Moderator Notes:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional review findings or feedback..."
                  className="w-full rounded border border-border bg-surface p-2 text-xs text-fg"
                />
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-xs">
                  <span>Award Bounty:</span>
                  <input
                    type="number"
                    step="0.25"
                    value={bountySol}
                    onChange={(e) => setBountySol(e.target.value)}
                    className="w-20 rounded border border-border bg-surface px-2 py-1 font-mono font-semibold"
                  />
                  <span className="font-mono text-fg-subtle">SOL</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="danger" onClick={handleReject}>
                    Reject
                  </Button>
                  <Button variant="primary" onClick={handleApprove}>
                    Approve & Publish to Site
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
