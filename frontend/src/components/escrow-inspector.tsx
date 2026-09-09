"use client";

import { useState } from "react";
import {
  ShieldIcon,
  CheckIcon,
  ArrowRightIcon,
  SpinnerIcon,
} from "./icons";

interface StepDetail {
  step: number;
  title: string;
  shortDesc: string;
  badge: string;
  pdaState: string;
  merkleStatus: string;
  codeSnippet: string;
  telemetry: { label: string; value: string }[];
}

const ESCROW_STEPS: StepDetail[] = [
  {
    step: 1,
    title: "Client Locks Milestone PDA",
    shortDesc: "Client deposits SOL into a non-custodial Program Derived Address (PDA) tied to the gig specification.",
    badge: "Deposit Locked",
    pdaState: "PDA: 8Vn...K4q (Status: FUNDED_LOCKED)",
    merkleStatus: "Awaiting developer session initialization",
    codeSnippet: `// Anchor Instruction: initialize_milestone_escrow
pub fn initialize_escrow(ctx: Context<InitEscrow>, amount_lamports: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_pda;
    escrow.client = ctx.accounts.client.key();
    escrow.creator = ctx.accounts.creator.key();
    escrow.amount = amount_lamports;
    escrow.state = EscrowState::Funded;
    Ok(())
}`,
    telemetry: [
      { label: "On-Chain Custody", value: "Non-Custodial PDA" },
      { label: "Solana Finality", value: "Confirmed (380ms)" },
      { label: "Arbitration Window", value: "72 Hours Max" },
    ],
  },
  {
    step: 2,
    title: "PoW Timelapse & Git Commits Logged",
    shortDesc: "Developer records continuous screen session. Every 2 seconds, frame hashes are computed into a Merkle tree.",
    badge: "Proof Streamed",
    pdaState: "PDA: 8Vn...K4q (Status: WORK_SUBMITTED)",
    merkleStatus: "Root: 0x9b3f47c8d92a1...e7f (14,400 leaves)",
    codeSnippet: `// Proof Artifact: SHA-256 Merkle Tree Attestation
const frameMerkleRoot = "0x9b3f47c8d92a15c8e03f90bb2451f28b4c9e01";
const gitCommitHash = "git:d4e7a89bc21104f981e3a47d2a58b091f0";
const entropyScore = 0.94; // Continuous cursor & buffer modifications

// Matches diff timestamps with video frame capture timestamps`,
    telemetry: [
      { label: "Frame Count", value: "14,400 Verified" },
      { label: "Git Diff Matches", value: "+842 / -129 lines" },
      { label: "Sanitization Audit", value: "0 Secret Leaks" },
    ],
  },
  {
    step: 3,
    title: "Moderation & SHA-256 Verification",
    shortDesc: "Automated entropy checks and manual moderator inspection confirm code authenticity and credential safety.",
    badge: "Verified & Approved",
    pdaState: "PDA: 8Vn...K4q (Status: VERIFICATION_PASSED)",
    merkleStatus: "Root Verified · Moderator Sig: 0x6e2...18c",
    codeSnippet: `// Moderator Multi-Sig Verification Attestation
pub fn verify_milestone_proof(ctx: Context<VerifyProof>, proof_hash: [u8; 32]) -> Result<()> {
    require!(ctx.accounts.moderator.is_signer, EscrowError::Unauthorized);
    let escrow = &mut ctx.accounts.escrow_pda;
    escrow.proof_hash = proof_hash;
    escrow.state = EscrowState::Verified;
    emit!(MilestoneVerified { escrow: escrow.key(), timestamp: Clock::get()?.unix_timestamp });
    Ok(())
}`,
    telemetry: [
      { label: "Entropy Verification", value: "PASS (>0.85)" },
      { label: "VCS Cross-Check", value: "100% Match" },
      { label: "Approval Latency", value: "< 2.4 Hours" },
    ],
  },
  {
    step: 4,
    title: "Instant Solana Settlement",
    shortDesc: "The Anchor program executes CPI transfer releasing funds directly to the developer's wallet.",
    badge: "Settled On-Chain",
    pdaState: "PDA: 8Vn...K4q (Status: SETTLED_RELEASED)",
    merkleStatus: "Tx: 4Kp7x...9Lq2 (Fee: 0.000005 SOL)",
    codeSnippet: `// Anchor CPI: transfer_lamports_from_pda
**escrow_pda.to_account_info().try_borrow_mut_lamports()? -= amount;
**creator.to_account_info().try_borrow_mut_lamports()? += amount;
escrow.state = EscrowState::Settled;
// Creator receives 100% of agreed milestone directly in wallet`,
    telemetry: [
      { label: "Transfer Time", value: "Instant (~400ms)" },
      { label: "Platform Fee", value: "0% for Early Creators" },
      { label: "Settlement Status", value: "Finalized" },
    ],
  },
];

export function EscrowInspector() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedSuccess, setSimulatedSuccess] = useState<boolean>(false);

  const current: StepDetail =
    ESCROW_STEPS.find((s) => s.step === activeStep) ?? (ESCROW_STEPS[0] as StepDetail);

  const handleSimulateRun = () => {
    setIsSimulating(true);
    setSimulatedSuccess(false);
    setTimeout(() => {
      setIsSimulating(false);
      setSimulatedSuccess(true);
      setTimeout(() => setSimulatedSuccess(false), 3500);
    }, 1200);
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldIcon size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-fg sm:text-base">
              Solana Anchor Milestone Escrow & Proof Verification State Machine
            </h3>
            <p className="text-xs text-fg-muted">
              Program ID: <code className="font-mono text-accent">sard_escrow_11111111111111111111111111111111</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateRun}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-accent disabled:opacity-60"
          >
            {isSimulating ? (
              <>
                <SpinnerIcon size={13} className="animate-spin text-accent" />
                <span>Checking Merkle Root...</span>
              </>
            ) : simulatedSuccess ? (
              <>
                <CheckIcon size={13} className="text-accent" />
                <span className="text-accent font-bold">Proof Validated</span>
              </>
            ) : (
              <>
                <span>Run Cryptographic Check</span>
                <ArrowRightIcon size={13} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step Navigator */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ESCROW_STEPS.map((s) => {
          const isActive = s.step === activeStep;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(s.step)}
              className={`flex flex-col text-left p-3 rounded-[var(--radius-control)] border transition-all ${
                isActive
                  ? "border-accent bg-accent-soft/30 shadow-sm"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-fg-subtle">
                  STEP 0{s.step}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive ? "bg-accent text-accent-fg font-semibold" : "bg-surface-raised text-fg-muted"
                }`}>
                  {s.badge}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-fg line-clamp-1">{s.title}</p>
            </button>
          );
        })}
      </div>

      {/* Current Step Active Detail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left: Explanation and Telemetry */}
        <div className="space-y-4 lg:col-span-6">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent">
              Active State Machine Node
            </span>
            <h4 className="mt-1 text-base font-bold text-fg">{current.title}</h4>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-fg-muted">
              {current.shortDesc}
            </p>
          </div>

          <div className="rounded-[var(--radius-control)] border border-border bg-surface-raised p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-fg-subtle">Solana Account State:</span>
              <span className="font-mono font-medium text-fg">{current.pdaState}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-subtle">Merkle Proof Tree:</span>
              <span className="font-mono font-medium text-accent truncate max-w-[240px]">
                {current.merkleStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {current.telemetry.map((t) => (
              <div key={t.label} className="rounded border border-border bg-surface p-2.5 text-center">
                <span className="block text-[10px] text-fg-subtle uppercase">{t.label}</span>
                <span className="mt-0.5 block font-mono text-xs font-bold text-fg truncate">
                  {t.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Rust/Anchor Instruction & Cryptographic Artifact */}
        <div className="lg:col-span-6">
          <div className="rounded-[var(--radius-control)] border border-border bg-[#0d1117] p-4 text-xs font-mono text-[#c9d1d9] overflow-x-auto h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#30363d] text-[11px] text-[#8b949e]">
                <span>anchor/programs/sardhana_escrow/src/lib.rs</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Verified Bytecode
                </span>
              </div>
              <pre className="leading-relaxed whitespace-pre-wrap">{current.codeSnippet}</pre>
            </div>
            <div className="mt-4 pt-2 border-t border-[#30363d] flex items-center justify-between text-[11px] text-[#8b949e]">
              <span>Anchor v0.30 · Solana 1.18</span>
              <span className="text-[#58a6ff]">Non-Custodial Architecture</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
