import type { Metadata } from "next";
import Link from "next/link";
import { Container, Badge } from "@/components/ui";
import { VerificationWorkstation } from "@/components/admin/verification-workstation";

export const metadata: Metadata = {
  title: "Admin Verification Queue · Manual Review & Listing Approval",
  description: "Moderator control station for verifying recorded timelapses, checking proof artifacts, and authorizing public listings and bounty releases.",
};

export default function AdminVerificationPage() {
  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Admin / Moderator Perspective</Badge>
            <span className="text-xs font-mono text-fg-subtle">MANUAL VERIFICATION ENGINE</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/creator/submissions" className="text-fg-muted hover:text-fg">
              Creator Submissions POV
            </Link>
            <span className="text-border-strong">·</span>
            <Link href="/hire" className="text-fg-muted hover:text-fg">
              Talent Acquisition POV
            </Link>
          </div>
        </div>

        <h1 className="mt-3 text-[28px] font-bold tracking-tight text-fg sm:text-[34px]">
          Manual Video Verification Queue
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Every uploaded session lands here before reaching the public catalog. Inspect screen
          timelapses, confirm authenticity against linked VCS commits, enforce credential safety, and
          release on-chain developer bounties.
        </p>
      </header>

      {/* Main Workstation */}
      <VerificationWorkstation />
    </Container>
  );
}
