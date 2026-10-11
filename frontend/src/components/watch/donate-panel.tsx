"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { cx, formatSol, solToLamports } from "@/lib/format";
import { sendSol, walletAvailable, WalletError } from "@/lib/wallet";
import type { DonationIntent, Timelapse } from "@/lib/types";
import { Avatar, Button, Card, Field, Input, Textarea, buttonClass } from "../ui";
import { ArrowRightIcon, CheckIcon, CopyIcon, SolanaIcon, WalletIcon } from "../ui/icons";
import { useToast } from "../layout/toast";

const PRESETS = [0.05, 0.1, 0.5, 1];

type Phase = "idle" | "signing" | "confirming" | "done";
type Mode = "wallet" | "direct";

export function DonatePanel({
  timelapse,
  payoutAddress,
}: {
  timelapse: Timelapse;
  payoutAddress?: string;
}) {
  const { success } = useToast();
  const [mode, setMode] = useState<Mode>("wallet");
  const [amount, setAmount] = useState("0.1");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");

  const lamports = solToLamports(Number(amount) || 0);
  const busy = phase === "signing" || phase === "confirming";

  async function donate() {
    setError("");
    if (lamports <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!walletAvailable()) {
      setError("No Solana wallet extension found in this browser.");
      return;
    }

    setPhase("signing");
    try {
      const intent = await api<DonationIntent>("/v1/donations", {
        body: {
          slug: timelapse.slug,
          donorAddress: await currentAddress(),
          amountLamports: lamports,
          message: message.trim(),
        },
      });

      const sent = await sendSol(intent.recipient, intent.amountLamports);
      setSignature(sent.signature);
      setPhase("confirming");

      await confirmWithRetry(intent.id, sent.signature);
      setPhase("done");
    } catch (err) {
      setPhase("idle");
      setError(readableError(err));
    }
  }

  function copyAddress() {
    if (!payoutAddress) return;
    navigator.clipboard.writeText(payoutAddress);
    success("Creator's Solana address copied");
  }

  if (phase === "done") {
    return (
      <Card className="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={18} />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold">Donation confirmed</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          {formatSol(lamports)} went to {timelapse.creator.displayName}, verified against the chain.
        </p>
        <p className="mt-4 break-all rounded-[var(--radius-control)] bg-surface-raised px-3 py-2 font-mono text-[11.5px] text-fg-subtle">
          {signature}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <SolanaIcon size={15} />
          Sponsor this work
        </h2>
        {payoutAddress ? (
          <div
            role="tablist"
            aria-label="Payment method"
            className="flex rounded-full bg-surface-raised p-1 text-[12px] font-medium"
          >
            {(["wallet", "direct"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cx(
                  "rounded-full px-3 py-1 transition-colors",
                  mode === m
                    ? "bg-surface text-fg shadow-[var(--shadow-card)]"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                {m === "wallet" ? "Extension" : "Mobile"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
        SOL goes straight from your wallet to {timelapse.creator.displayName}. No custody, no cut.
      </p>

      {mode === "wallet" ? (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {PRESETS.map((preset) => {
              const selected = amount === String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  aria-pressed={selected}
                  className={cx(
                    "press h-10 rounded-[var(--radius-control)] border font-mono text-[13px] tabular-nums transition-colors",
                    selected
                      ? "border-fg bg-inverse text-inverse-fg"
                      : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-4">
            <Field label="Amount in SOL" htmlFor="donation-amount">
              <Input
                id="donation-amount"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field
              label="Message"
              htmlFor="donation-message"
              hint="Optional. Shown publicly with your donation."
            >
              <Textarea
                id="donation-message"
                rows={2}
                maxLength={280}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What made this worth funding?"
              />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
          <Button onClick={donate} loading={busy} className="mt-5 w-full" size="lg">
            {!busy ? <WalletIcon size={16} /> : null}
            {phase === "signing"
              ? "Waiting for your wallet"
              : phase === "confirming"
                ? "Confirming on chain"
                : `Send ${formatSol(lamports)}`}
          </Button>
          <p className="mt-3 text-center text-[12px] text-fg-subtle">
            Your wallet shows the exact recipient before you approve.
          </p>
        </>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="rounded-[var(--radius-control)] border border-border bg-surface-raised p-3">
            <span className="text-[11.5px] font-medium text-fg-subtle">
              Verified payout address
            </span>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="select-all truncate font-mono text-[12px] text-fg">
                {payoutAddress}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                aria-label="Copy address"
                className="press shrink-0 rounded-md border border-border bg-surface p-1.5 text-fg-subtle hover:text-fg"
              >
                <CopyIcon size={14} />
              </button>
            </div>
          </div>
          <a
            href={`solana:${payoutAddress}?amount=${encodeURIComponent(amount)}`}
            className={buttonClass("secondary", "md", "w-full")}
          >
            <SolanaIcon size={13} />
            Open in a mobile wallet
          </a>
          <p className="text-[12px] leading-relaxed text-fg-subtle">
            A transfer sent this way still reaches {timelapse.creator.displayName}, but Hustle On
            cannot link it to you, so it will not be listed under Sponsors. Use the extension tab
            to be credited.
          </p>
        </div>
      )}
    </Card>
  );
}

async function currentAddress(): Promise<string> {
  const { connectWallet } = await import("@/lib/wallet");
  return connectWallet();
}

async function confirmWithRetry(id: string, signature: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const result = await api<{ status: string }>(`/v1/donations/${id}/confirm`, {
      body: { signature },
    });
    if (result.status === "confirmed") return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(
    "Your transaction was sent but has not finalized yet. It will be credited automatically once it does.",
  );
}

function readableError(err: unknown): string {
  if (err instanceof WalletError) return err.message;
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has ended. Sign in again to sponsor.";
    return err.message;
  }
  if (err instanceof Error) {
    if (/reject|denied|cancel/i.test(err.message)) return "You cancelled the transaction.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}

export function SupporterList({
  donations,
}: {
  donations: {
    id: string;
    amountLamports: number;
    message?: string;
    donor?: { handle: string; displayName: string };
  }[];
}) {
  if (donations.length === 0) {
    return <p className="text-sm text-fg-muted">No sponsors yet. Be the first.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {donations.map((d) => (
        <li key={d.id} className="flex items-start gap-3 py-3">
          <Avatar name={d.donor?.displayName ?? "Anonymous"} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
            {d.message ? (
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{d.message}</p>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-fg">
            {formatSol(d.amountLamports)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const SIGN_IN_POINTS = [
  "Your name appears with your sponsorship",
  "Every transfer is verified on-chain before it counts",
  "One email link, no password to remember",
];

export function SponsorSignIn({ slug, name }: { slug: string; name: string }) {
  const next = `/watch/${slug}#sponsor`;
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <SolanaIcon size={15} />
        Sponsor this work
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
        Sign in to send SOL to {name}. It goes wallet to wallet, with no cut taken.
      </p>
      <ul className="mt-5 space-y-2.5">
        {SIGN_IN_POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[13px] text-fg-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon size={10} />
            </span>
            {point}
          </li>
        ))}
      </ul>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className={buttonClass("primary", "lg", "mt-6 w-full")}
      >
        Sign in to sponsor
        <ArrowRightIcon size={16} className="nudge-icon" />
      </Link>
      <p className="mt-3 text-center text-[12px] text-fg-subtle">
        New here? The same link creates your account.
      </p>
    </Card>
  );
}

export function DonationsUnavailable({ name }: { name: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[16px] font-semibold">Sponsorship not set up</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
        {name} has not verified a payout wallet yet, so there is nowhere to send SOL.
      </p>
    </Card>
  );
}
