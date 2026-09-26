"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { formatSol, solToLamports } from "@/lib/format";
import { sendSol, walletAvailable, WalletError } from "@/lib/wallet";
import type { DonationIntent, Timelapse } from "@/lib/types";
import { Button, Card, Field, Input, Textarea } from "../ui";
import { CopyIcon, QrCodeIcon, SolanaIcon, WalletIcon } from "../ui/icons";
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
      setError("No Solana wallet extension detected. You can switch to QR / Direct mode below.");
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
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Donation confirmed</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          {formatSol(lamports)} went to {timelapse.creator.displayName}. Verified against the chain,
          not just reported by your wallet.
        </p>
        <p className="mt-3 break-all font-mono text-[12px] text-fg-subtle">{signature}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <SolanaIcon size={15} />
          Support this work
        </h2>

        {payoutAddress && (
          <div className="flex rounded-md border border-border bg-surface p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setMode("wallet")}
              className={`rounded px-2 py-0.5 transition-colors ${
                mode === "wallet"
                  ? "bg-surface-raised font-semibold text-fg"
                  : "text-fg-subtle hover:text-fg"
              }`}
            >
              Browser
            </button>
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={`rounded px-2 py-0.5 transition-colors ${
                mode === "direct"
                  ? "bg-surface-raised font-semibold text-fg"
                  : "text-fg-subtle hover:text-fg"
              }`}
            >
              Direct / QR
            </button>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-sm text-fg-muted">
        SOL goes straight from your wallet to {timelapse.creator.displayName}. Sardhana never holds
        it and takes no cut.
      </p>

      {mode === "wallet" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                aria-pressed={amount === String(preset)}
                className={
                  "h-8 rounded-[var(--radius-control)] border px-3 text-[13px] tabular-nums transition-colors " +
                  (amount === String(preset)
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-fg-muted hover:border-border-strong hover:text-fg")
                }
              >
                {preset} SOL
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Amount in SOL" htmlFor="donation-amount">
              <Input
                id="donation-amount"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </Field>

            <Field
              label="Message"
              htmlFor="donation-message"
              hint="Optional, shown publicly with your donation."
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

          <Button onClick={donate} loading={busy} className="mt-4 w-full" size="lg">
            {!busy ? <WalletIcon size={16} /> : null}
            {phase === "signing"
              ? "Waiting for your wallet…"
              : phase === "confirming"
                ? "Confirming on chain…"
                : `Send ${formatSol(lamports)}`}
          </Button>

          <p className="mt-3 text-[12px] text-fg-subtle">
            Your wallet will show the exact recipient before you approve anything.
          </p>
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-surface p-3">
            <span className="text-[11px] font-medium text-fg-subtle">Creator Verified Payout Address</span>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-[12px] text-fg select-all">
                {payoutAddress}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                aria-label="Copy address"
                className="press shrink-0 rounded-md border border-border bg-surface-raised p-1.5 text-fg-subtle hover:text-fg"
              >
                <CopyIcon size={14} />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface-raised/40 p-4 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-lg border border-border bg-surface p-2 shadow-xs">

              <div className="flex flex-col items-center justify-center gap-1.5 text-fg-muted">
                <QrCodeIcon size={56} />
                <span className="font-mono text-[9px] tracking-tight text-fg-subtle">Scan with Mobile Wallet</span>
              </div>
            </div>

            <p className="mt-3 text-[12px] text-fg-muted">
              Scan with Phantom, Backpack, or Solflare mobile app to send SOL directly to this creator.
            </p>

            <a
              href={`solana:${payoutAddress}?amount=${amount}`}
              className="press mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-fg hover:border-border-strong"
            >
              <SolanaIcon size={12} />
              Open Mobile Wallet Link
            </a>
          </div>
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
  if (err instanceof ApiError) return err.message;
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
    return <p className="text-sm text-fg-muted">No donations yet. Be the first.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {donations.map((d) => (
        <li key={d.id} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
            {d.message ? <p className="mt-0.5 text-[13px] text-fg-muted">{d.message}</p> : null}
          </div>
          <span className="shrink-0 text-sm tabular-nums text-fg-muted">
            {formatSol(d.amountLamports)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DonationsUnavailable({ handle }: { handle: string }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Donations not set up</h2>
      <p className="mt-1.5 text-sm text-fg-muted">
        {handle} has not verified a wallet yet, so there is nowhere to send SOL.
      </p>
    </Card>
  );
}
