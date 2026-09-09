import type { Metadata } from "next";
import { Container, Card, Badge, ButtonLink, Stat } from "@/components/ui";
import { WalletIcon, CheckIcon, UploadIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Earnings & Payout Ledger · Creator Studio",
  description: "View your verified timelapse bounties, audience sponsorships, commercial licensing sales, and on-chain Solana settlements.",
};

interface PayoutTransaction {
  id: string;
  type: "Bounty" | "Sponsorship" | "License" | "Escrow Milestone";
  sessionTitle: string;
  amountSol: number;
  amountUsd: number;
  recipientWallet: string;
  txHash: string;
  settledAt: string;
  status: "settled" | "processing";
}

const MOCK_PAYOUTS: PayoutTransaction[] = [
  {
    id: "TX-9402",
    type: "Bounty",
    sessionTitle: "Solana Anchor DEX Smart Contract with Formal Escrow",
    amountSol: 1.75,
    amountUsd: 262.5,
    recipientWallet: "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG",
    txHash: "5KtP9xZ...98f4",
    settledAt: "2026-09-08T15:20:00Z",
    status: "settled",
  },
  {
    id: "TX-9381",
    type: "Sponsorship",
    sessionTitle: "Rust Write-Ahead Log Engine & Concurrency Benchmarks",
    amountSol: 0.5,
    amountUsd: 75.0,
    recipientWallet: "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG",
    txHash: "3LmK1vA...11d8",
    settledAt: "2026-09-07T18:42:00Z",
    status: "settled",
  },
  {
    id: "TX-9350",
    type: "License",
    sessionTitle: "Low-Poly Cyber City Asset Pack in Blender 4.2",
    amountSol: 0.98,
    amountUsd: 147.0,
    recipientWallet: "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG",
    txHash: "8NxQ2wE...77a1",
    settledAt: "2026-09-05T11:15:00Z",
    status: "settled",
  },
  {
    id: "TX-9219",
    type: "Escrow Milestone",
    sessionTitle: "Milestone 2/3: Realtime Websocket Gateway Deliverable",
    amountSol: 12.0,
    amountUsd: 1800.0,
    recipientWallet: "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG",
    txHash: "2JzR8mK...44c2",
    settledAt: "2026-09-01T16:00:00Z",
    status: "settled",
  },
];

export default function CreatorEarningsPage() {
  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">Creator Perspective</Badge>
            <span className="text-xs font-mono text-fg-subtle">ON-CHAIN PAYOUT LEDGER</span>
          </div>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-fg sm:text-[32px]">
            Earnings & Payout Ledger
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Direct, non-custodial payouts settled via Solana Anchor contracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ButtonLink href="/creator" variant="secondary">
            Creator Studio
          </ButtonLink>
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            Upload to Earn
          </ButtonLink>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <Stat label="Total Earned" value="28.45 SOL" hint="~$4,267 USD" />
        </Card>
        <Card className="p-5">
          <Stat label="Verified Bounties" value="6.25 SOL" hint="From review approvals" />
        </Card>
        <Card className="p-5">
          <Stat label="Commercial Licenses" value="3.20 SOL" hint="Footage royalties" />
        </Card>
        <Card className="p-5">
          <Stat label="Client Milestone Escrows" value="19.00 SOL" hint="From custom hires" />
        </Card>
      </div>

      {/* Payout Wallet Settings banner */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <WalletIcon size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">Active Settlement Wallet (Solana)</p>
            <p className="font-mono text-xs text-fg-muted">
              7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckIcon size={12} /> Auto-Settlement Active
          </span>
        </div>
      </div>

      {/* Detailed Ledger Table */}
      <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[12px] text-fg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Session / Deliverable</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Transaction Hash</th>
              <th className="px-4 py-3 font-medium">Settled Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {MOCK_PAYOUTS.map((tx) => (
              <tr key={tx.id} className="transition-colors hover:bg-surface-raised">
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-fg">{tx.type}</span>
                  <p className="font-mono text-[11px] text-fg-subtle">{tx.id}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-fg max-w-sm truncate">{tx.sessionTitle}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-mono font-semibold text-accent">+{tx.amountSol} SOL</p>
                  <p className="text-[11px] text-fg-subtle">${tx.amountUsd.toFixed(2)} USD</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-[12px] text-fg-muted">
                  <span className="hover:text-accent cursor-pointer underline underline-offset-2">
                    {tx.txHash}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-fg-muted">
                  {new Date(tx.settledAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone="accent">Settled</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
