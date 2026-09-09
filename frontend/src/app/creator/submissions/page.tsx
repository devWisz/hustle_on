import type { Metadata } from "next";
import Link from "next/link";
import { Container, Card, Badge, ButtonLink } from "@/components/ui";
import {
  CheckIcon,
  UploadIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Submissions & Verification Status · Creator Studio",
  description: "Track your uploaded timelapses through the manual moderator verification queue.",
};

interface SubmissionItem {
  id: string;
  title: string;
  category: string;
  realHours: number;
  timelapseMinutes: number;
  speedRatio: number;
  submittedAt: string;
  status: "pending_verification" | "in_review" | "approved" | "revision_requested";
  bountyEarnedSol?: number;
  checklist: {
    screenActivity: boolean;
    gitMatch: boolean;
    secretScanClean: boolean;
    qualityMet: boolean;
  };
  moderatorNotes?: string;
}

const MOCK_SUBMISSIONS: SubmissionItem[] = [
  {
    id: "SUB-849204",
    title: "Rust Write-Ahead Log Engine & Concurrency Benchmarks",
    category: "Software & Systems Engineering",
    realHours: 6.5,
    timelapseMinutes: 4.2,
    speedRatio: 45,
    submittedAt: "2026-09-09T10:15:00Z",
    status: "in_review",
    bountyEarnedSol: 1.25,
    checklist: {
      screenActivity: true,
      gitMatch: true,
      secretScanClean: true,
      qualityMet: true,
    },
    moderatorNotes: "Screen recording quality confirmed 1080p60. Checking commit hash 9b3d1f against GitHub repo.",
  },
  {
    id: "SUB-710492",
    title: "Solana Anchor DEX Smart Contract with Formal Escrow",
    category: "Smart Contracts & Solana / Anchor",
    realHours: 8.0,
    timelapseMinutes: 5.1,
    speedRatio: 60,
    submittedAt: "2026-09-08T14:30:00Z",
    status: "approved",
    bountyEarnedSol: 1.75,
    checklist: {
      screenActivity: true,
      gitMatch: true,
      secretScanClean: true,
      qualityMet: true,
    },
    moderatorNotes: "Approved and listed. Sol bounty 1.75 SOL dispatched to primary wallet. High-quality session.",
  },
  {
    id: "SUB-629184",
    title: "Mobile Financial Dashboard in Figma (Auto-layout & Prototyping)",
    category: "UI/UX Product Design & Figma",
    realHours: 4.5,
    timelapseMinutes: 3.8,
    speedRatio: 35,
    submittedAt: "2026-09-06T18:00:00Z",
    status: "approved",
    bountyEarnedSol: 1.0,
    checklist: {
      screenActivity: true,
      gitMatch: true,
      secretScanClean: true,
      qualityMet: true,
    },
    moderatorNotes: "Figma design canvas verified. Layer structure inspected.",
  },
  {
    id: "SUB-519283",
    title: "Low-Poly Cyber City Asset Pack in Blender 4.2",
    category: "3D Modeling, Blender & Game Dev",
    realHours: 7.0,
    timelapseMinutes: 4.5,
    speedRatio: 50,
    submittedAt: "2026-09-04T09:20:00Z",
    status: "approved",
    bountyEarnedSol: 1.5,
    checklist: {
      screenActivity: true,
      gitMatch: true,
      secretScanClean: true,
      qualityMet: true,
    },
    moderatorNotes: "Topology and UV unwrapping verified authentic.",
  },
];

function statusBadge(status: SubmissionItem["status"]) {
  switch (status) {
    case "approved":
      return <Badge tone="accent">Approved & Listed</Badge>;
    case "in_review":
      return <Badge tone="neutral">In Review by Moderator</Badge>;
    case "pending_verification":
      return <Badge tone="neutral">Queued for Review</Badge>;
    case "revision_requested":
      return <Badge tone="danger">Revision Needed</Badge>;
  }
}

export default function CreatorSubmissionsPage() {
  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">Creator Perspective</Badge>
            <span className="text-xs font-mono text-fg-subtle">VERIFICATION QUEUE AUDIT</span>
          </div>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-fg sm:text-[32px]">
            Timelapse Submissions Tracker
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Track the review status, moderation checklist results, and bounty disbursements for every uploaded session.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ButtonLink href="/creator" variant="secondary">
            Creator Studio
          </ButtonLink>
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            Upload New Timelapse
          </ButtonLink>
        </div>
      </div>

      {/* Submissions List */}
      <div className="mt-8 space-y-5">
        {MOCK_SUBMISSIONS.map((sub) => (
          <Card key={sub.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-fg-subtle">{sub.id}</span>
                  <span className="text-border-strong">·</span>
                  <span className="text-xs text-fg-muted">{sub.category}</span>
                  <span className="text-border-strong">·</span>
                  <span className="text-xs text-fg-subtle">
                    Submitted {new Date(sub.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-1.5 text-[18px] font-semibold text-fg">{sub.title}</h3>
                <p className="mt-1 text-xs text-fg-muted font-mono">
                  Real Work Time: {sub.realHours} hours compressed to {sub.timelapseMinutes} mins ({sub.speedRatio}x speed)
                </p>
              </div>

              <div className="text-right">
                <div>{statusBadge(sub.status)}</div>
                {sub.bountyEarnedSol && (
                  <p className="mt-2 font-mono text-sm font-bold text-accent">
                    +{sub.bountyEarnedSol} SOL Bounty
                  </p>
                )}
              </div>
            </div>

            {/* Moderation Checklist & Notes */}
            <div className="mt-4 grid gap-4 lg:grid-cols-12 items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-medium text-fg-subtle mb-2">Manual Verification Checklist:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-fg">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CheckIcon size={10} />
                    </span>
                    <span>Screen Activity</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-fg">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CheckIcon size={10} />
                    </span>
                    <span>Git Proof Match</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-fg">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CheckIcon size={10} />
                    </span>
                    <span>No Secret Leaks</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-fg">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CheckIcon size={10} />
                    </span>
                    <span>1080p Quality</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 rounded-[var(--radius-control)] border border-border bg-surface-raised p-3 text-xs">
                <span className="font-semibold text-fg">Moderator Note:</span>
                <p className="mt-0.5 text-fg-muted leading-relaxed line-clamp-2">
                  {sub.moderatorNotes}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Admin Queue Callout */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[var(--radius-card)] border border-dashed border-border bg-surface p-5">
        <div>
          <h4 className="text-sm font-semibold text-fg">Are you a platform moderator or administrator?</h4>
          <p className="text-xs text-fg-muted mt-0.5">
            Switch to the Admin Panel to review pending timelapses, verify code authenticity, and approve listing releases.
          </p>
        </div>
        <Link
          href="/admin/verification"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-xs font-medium text-fg hover:bg-surface-raised"
        >
          Open Admin Verification Queue <ArrowRightIcon size={14} />
        </Link>
      </div>
    </Container>
  );
}
