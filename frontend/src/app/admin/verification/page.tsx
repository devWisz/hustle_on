import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { Container, Badge } from "@/components/ui";
import { VerificationWorkstation } from "@/components/admin/verification-workstation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Verification Queue · Manual Review & Listing Approval",
  description: "Moderator control station for verifying recorded timelapses, checking proof artifacts, and authorizing public listings and bounty releases.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminVerificationPage() {
  const me = await apiServer<SelfUser>("/v1/me");
  if (!me || (me.role !== "admin" && me.role !== "moderator")) {
    notFound();
  }

  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Internal Review Console</Badge>
            <span className="text-xs font-mono text-fg-subtle">RBAC: {me.role.toUpperCase()}</span>
          </div>
          <div className="text-xs font-mono text-fg-muted">
            Auditor: {me.handle} ({me.email})
          </div>
        </div>

        <h1 className="mt-3 text-[26px] font-bold tracking-tight text-fg sm:text-[30px]">
          Manual Video Verification Queue
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-fg-muted">
          Inspect recorded screen timelapses, verify matching VCS commit logs, sanitize credential exposures,
          and authorize on-chain Solana bounty releases.
        </p>
      </header>

      {/* Main Workstation */}
      <VerificationWorkstation />
    </Container>
  );
}
