import type { Metadata } from "next";
import { Container, Card, Badge, ButtonLink } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Creator Guide: How to Create Timelapses & Get Paid",
  description: "Learn how to record work sessions, choose optimal timelapse speed ratios, submit proof of work, and maximize bounties.",
};

export default function HowToEarnPage() {
  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Badge tone="accent">Creator Guide</Badge>
          <span className="text-xs font-mono text-fg-subtle">STANDARDS & PLAYBOOK</span>
        </div>
        <h1 className="mt-3 text-[30px] font-bold tracking-tight text-fg sm:text-[38px]">
          How to Create a Timelapse & Get Paid
        </h1>
        <p className="mt-2 text-[16px] leading-relaxed text-fg-muted">
          Follow these standards to guarantee that your sessions pass manual moderator review on the
          first attempt, unlock maximum verified bounties, and attract top-paying clients.
        </p>
      </div>

      {/* 3 Step Workflow */}
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <Card className="p-6">
          <span className="font-mono text-xs font-bold text-accent">STEP 01</span>
          <h3 className="mt-2 text-[18px] font-semibold text-fg">Capture Deep Work</h3>
          <p className="mt-2 text-sm text-fg-muted leading-relaxed">
            Record your workstation while building real software, designing interfaces in Figma, or modeling in Blender. Keep screen activity active and genuine.
          </p>
        </Card>

        <Card className="p-6">
          <span className="font-mono text-xs font-bold text-accent">STEP 02</span>
          <h3 className="mt-2 text-[18px] font-semibold text-fg">Compress & Upload</h3>
          <p className="mt-2 text-sm text-fg-muted leading-relaxed">
            Speed up your video between 30x and 60x so a multi-hour session becomes a crisp 3 to 6 minute reel. Link your Git commits or Figma proof.
          </p>
        </Card>

        <Card className="p-6">
          <span className="font-mono text-xs font-bold text-accent">STEP 03</span>
          <h3 className="mt-2 text-[18px] font-semibold text-fg">Pass Review & Get Paid</h3>
          <p className="mt-2 text-sm text-fg-muted leading-relaxed">
            Our moderators manually verify screen authenticity and proof links. Once approved, you receive an automated SOL bounty and public listing.
          </p>
        </Card>
      </div>

      {/* Recommended Recording Tools */}
      <div className="mt-12 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">Recommended Capture Software</h2>
        <p className="mt-1 text-sm text-fg-muted">
          You can use any screen recording tool that exports high-definition video.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3 text-sm">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4">
            <h4 className="font-semibold text-fg">OBS Studio (Free & Open Source)</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Best for full customization. Set output to 1080p, 30fps or 60fps, and record to MP4 or MKV. You can speed it up in your editor (Premiere, Resolve, or ffmpeg).
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4">
            <h4 className="font-semibold text-fg">Kap / ScreenCat (macOS)</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Lightweight open-source menu bar recorders. Clean system UI with automatic window or display selection.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4">
            <h4 className="font-semibold text-fg">Automated ffmpeg Timelapse Script</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Take a frame screenshot every 2 seconds and assemble into 60fps video. Zero CPU overhead during coding.
            </p>
          </div>
        </div>
      </div>

      {/* Speed Multiplier Matrix */}
      <div className="mt-12 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[600px] text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[12px] text-fg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Domain / Discipline</th>
              <th className="px-4 py-3 font-medium">Real Session Duration</th>
              <th className="px-4 py-3 font-medium">Recommended Speed</th>
              <th className="px-4 py-3 font-medium">Final Video Length</th>
              <th className="px-4 py-3 font-medium">Target Bounty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            <tr>
              <td className="px-4 py-3 font-medium text-fg">Systems & Backend (Rust, Go)</td>
              <td className="px-4 py-3 text-fg-muted">6 to 8 hours</td>
              <td className="px-4 py-3 font-mono text-accent">50x - 60x</td>
              <td className="px-4 py-3 text-fg-muted">4 - 6 mins</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">1.5 - 2.0 SOL</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-fg">Smart Contracts & Escrow (Anchor)</td>
              <td className="px-4 py-3 text-fg-muted">4 to 6 hours</td>
              <td className="px-4 py-3 font-mono text-accent">40x - 50x</td>
              <td className="px-4 py-3 text-fg-muted">4 - 5 mins</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">1.25 - 1.75 SOL</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-fg">UI/UX Design (Figma, Spline)</td>
              <td className="px-4 py-3 text-fg-muted">3 to 5 hours</td>
              <td className="px-4 py-3 font-mono text-accent">30x - 40x</td>
              <td className="px-4 py-3 text-fg-muted">3 - 5 mins</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">0.75 - 1.25 SOL</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-fg">3D Modeling & Shading (Blender)</td>
              <td className="px-4 py-3 text-fg-muted">5 to 8 hours</td>
              <td className="px-4 py-3 font-mono text-accent">60x - 80x</td>
              <td className="px-4 py-3 text-fg-muted">4 - 6 mins</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">1.25 - 1.75 SOL</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action CTA */}
      <div className="mt-10 flex justify-center">
        <ButtonLink href="/upload" size="lg">
          Upload your timelapse now
          <ArrowRightIcon size={17} />
        </ButtonLink>
      </div>
    </Container>
  );
}
