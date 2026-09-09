import type { Metadata } from "next";
import Link from "next/link";
import { Container, Card, ButtonLink, Stat } from "@/components/ui";
import {
  UploadIcon,
  WalletIcon,
  ShieldIcon,
  ArrowRightIcon,
  CheckIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Creator Studio · Create, Upload & Get Paid",
  description: "Record your build sessions, submit proof-of-work timelapses, track verification progress, and manage on-chain payouts.",
};

export default function CreatorStudioPage() {
  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Top Banner & Quick Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-accent">
            <span>Creator / Uploader Perspective</span>
          </div>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight text-fg sm:text-[34px]">
            Creator Studio & Monetization
          </h1>
          <p className="mt-1 text-sm text-fg-muted max-w-xl">
            Upload your deep work timelapses, pass manual verification, receive bounties, and build a verifiable track record for clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/creator/submissions" variant="secondary">
            View Submissions Queue
          </ButtonLink>
          <ButtonLink href="/creator/earnings" variant="secondary">
            <WalletIcon size={16} />
            Earnings & Payouts
          </ButtonLink>
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            Upload New Session
          </ButtonLink>
        </div>
      </div>

      {/* Creator Metrics Ribbon */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <Stat label="Total Earned" value="28.45 SOL" hint="~$4,260 USD" />
        </Card>
        <Card className="p-5">
          <Stat label="Verified Build Hours" value="142.5 hrs" hint="Manually verified" />
        </Card>
        <Card className="p-5">
          <Stat label="Published Sessions" value="18" hint="In public catalog" />
        </Card>
        <Card className="p-5">
          <Stat label="Pending Verification" value="1 session" hint="Review in progress" />
        </Card>
      </div>

      {/* 4 Core Creator Portals */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent mb-4">
              <UploadIcon size={20} />
            </div>
            <h3 className="text-[17px] font-semibold text-fg">Upload Timelapse</h3>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">
              Step-by-step upload wizard with speed ratio validation, Git commit proof binding, and payout configuration.
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <Link href="/upload" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              Start upload wizard <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-surface-raised text-fg mb-4">
              <ShieldIcon size={20} />
            </div>
            <h3 className="text-[17px] font-semibold text-fg">Submissions Tracker</h3>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">
              Track your videos through the manual moderation queue: screen authenticity checks, git verification, and feedback.
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <Link href="/creator/submissions" className="text-sm font-medium text-fg hover:underline flex items-center gap-1">
              Check submission status <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent mb-4">
              <WalletIcon size={20} />
            </div>
            <h3 className="text-[17px] font-semibold text-fg">Earnings & Payouts</h3>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">
              Audit every SOL and USDC settlement: verified bounties, commercial license royalties, and client escrow releases.
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <Link href="/creator/earnings" className="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              View payout ledger <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-surface-raised text-fg mb-4">
              <CheckIcon size={20} />
            </div>
            <h3 className="text-[17px] font-semibold text-fg">Recording Guide</h3>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">
              Software setup for OBS & ScreenCat, compression speed guidelines, and tips to guarantee first-pass verification approval.
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <Link href="/creator/how-to-earn" className="text-sm font-medium text-fg hover:underline flex items-center gap-1">
              Read creator guidelines <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Card>
      </div>

      {/* How Creators Get Paid Table */}
      <div className="mt-14 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">Four Ways to Get Paid on HustlerOn</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Every verified timelapse activates multiple monetization streams automatically.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-l-2 border-accent pl-4">
            <span className="font-mono text-xs text-accent font-semibold">STREAM 01</span>
            <h4 className="mt-1 font-semibold text-[15px] text-fg">Verified Proof Bounties</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Paid straight from the platform foundation treasury whenever a submission passes manual review with valid Git/design proof ($50–$250 in SOL).
            </p>
          </div>

          <div className="border-l-2 border-border-strong pl-4">
            <span className="font-mono text-xs text-fg-subtle font-semibold">STREAM 02</span>
            <h4 className="mt-1 font-semibold text-[15px] text-fg">Direct Viewer Sponsorships</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Followers, fans, and ecosystem foundations tip your sessions via Solana transactions. 100% of tips go directly to your primary wallet.
            </p>
          </div>

          <div className="border-l-2 border-accent pl-4">
            <span className="font-mono text-xs text-accent font-semibold">STREAM 03</span>
            <h4 className="mt-1 font-semibold text-[15px] text-fg">Footage Licensing</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Studios, brands, and ed-tech companies license your high-speed building footage for reels and marketing at your set commercial fee ($49+).
            </p>
          </div>

          <div className="border-l-2 border-border-strong pl-4">
            <span className="font-mono text-xs text-fg-subtle font-semibold">STREAM 04</span>
            <h4 className="mt-1 font-semibold text-[15px] text-fg">Milestone Client Contracts</h4>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
              Clients hire you directly for bounties & development contracts with funds locked in milestone escrows, released upon proof upload.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
