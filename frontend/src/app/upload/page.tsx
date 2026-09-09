import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { Container, Badge } from "@/components/ui";
import { CreatorUploadStepper } from "@/components/creator/creator-upload-stepper";
import { ShieldIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Upload Timelapse & Get Paid · Creator Studio",
  description: "Upload your recorded build session, submit verifiable proof, and receive automated bounties upon manual verification.",
};

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export default async function UploadPage() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0).catch(() => null);
  const isAuthenticated = Boolean(session?.authenticated);
  const userWallet = session?.user?.primaryWallet;

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      {/* Header & Perspectives Banner */}
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="accent">Creator Perspective</Badge>
            <span className="text-[12px] text-fg-subtle font-mono">STEP-BY-STEP SUBMISSION</span>
          </div>
          <Link
            href="/creator/how-to-earn"
            className="text-[12px] text-accent hover:underline flex items-center gap-1 font-medium"
          >
            How to earn & bounty tiers <ArrowRightIcon size={12} />
          </Link>
        </div>

        <h1 className="mt-3 text-[28px] font-bold tracking-tight text-fg sm:text-[32px]">
          Upload Timelapse & Get Paid
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          Turn your focused build hours into verifiable proof-of-work. Every submitted recording
          passes through our manual moderator verification queue to guarantee authenticity before
          being listed and rewarded.
        </p>
      </header>

      {/* Unauthenticated notice if testing locally */}
      {!isAuthenticated && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13px]">
          <ShieldIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1">
            <p className="font-medium text-fg">Preview Mode (No Active Session)</p>
            <p className="text-fg-muted mt-0.5">
              You can test the full verification upload flow below. To bind payouts to your permanent
              Solana wallet, you can{" "}
              <Link href="/login?next=/upload" className="text-accent underline font-medium">
                sign in anytime
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Stepper Component */}
      <CreatorUploadStepper userWallet={userWallet} />

      {/* Payout & Verification FAQs */}
      <div className="mt-12 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
        <h3 className="text-base font-semibold text-fg">How does manual verification and payout work?</h3>
        <div className="mt-4 grid gap-4 text-[13px] text-fg-muted sm:grid-cols-2">
          <div>
            <h4 className="font-medium text-fg">1. Moderator Inspection Queue</h4>
            <p className="mt-1 leading-relaxed">
              Once uploaded, your timelapse enters the moderator queue. A moderator validates screen
              continuity, matches your code against the attached Git repository, and audits for
              sensitive credentials.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-fg">2. Instant On-Chain Payout</h4>
            <p className="mt-1 leading-relaxed">
              When approved, the session is published to the explore feed and your verified bounty
              is disbursed to your Solana wallet via non-custodial Anchor escrow.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-fg">3. Commercial Licensing</h4>
            <p className="mt-1 leading-relaxed">
              Agencies and companies can purchase non-exclusive rights to use your build footage in
              marketing materials. Royalties go directly to your wallet.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-fg">4. Client Inquiries & Milestone Escrows</h4>
            <p className="mt-1 leading-relaxed">
              Clients browsing the talent catalog can hire you for custom projects with escrow-funded
              milestones paid upon your timelapse deliverable submission.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
