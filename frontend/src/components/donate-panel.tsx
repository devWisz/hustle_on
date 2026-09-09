"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatSol, solToLamports } from "@/lib/format";
import { sendSol, walletAvailable, WalletError } from "@/lib/wallet";
import type { DonationIntent, Timelapse } from "@/lib/types";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { SolanaIcon, WalletIcon } from "./icons";

const PRESETS = [0.05, 0.1, 0.5, 1];

type Phase = "idle" | "signing" | "confirming" | "done";

/**
 * Sends SOL to the creator of a timelapse.
 *
 * The transfer is wallet to wallet: the site never holds the money and never
 * sees a key. What it does is record the intent first — so the amount and the
 * recipient are fixed by the server — then hand back the signature so the API
 * can check the chain before crediting anything.
 */
export function DonatePanel({ timelapse }: { timelapse: Timelapse }) {
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
      setError("No Solana wallet found in this browser. Install one, then reload this page.");
      return;
    }

    setPhase("signing");
    try {
      // The intent comes first. The server decides the recipient from the
      // creator's verified address, so a tampered page cannot redirect it.
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

      // Confirmation can lag finalization by a few seconds, so a "not yet"
      // answer is retried rather than surfaced as a failure.
      await confirmWithRetry(intent.id, sent.signature);
      setPhase("done");
    } catch (err) {
      setPhase("idle");
      setError(readableError(err));
    }
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
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <SolanaIcon size={15} />
        Support this work
      </h2>
      <p className="mt-1.5 text-sm text-fg-muted">
        SOL goes straight from your wallet to {timelapse.creator.displayName}. Sardhana never holds
        it and takes no cut.
      </p>

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
    </Card>
  );
}

/** Connects the wallet if needed and returns the address that will pay. */
async function currentAddress(): Promise<string> {
  const { connectWallet } = await import("@/lib/wallet");
  return connectWallet();
}

/**
 * Confirms the donation, retrying while the transaction is still settling.
 *
 * The API answers 202 with `status: "submitted"` until the transaction is
 * finalized. Giving up on the first one would tell a donor their money vanished
 * when it is simply a few seconds early.
 */
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
    // Wallets report a user-cancelled approval as a rejection; that is a
    // decision, not a fault, so it is worded as one.
    if (/reject|denied|cancel/i.test(err.message)) return "You cancelled the transaction.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}

/** The supporter list under a timelapse. */
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

/** Shown in place of the panel when a creator has no wallet on file. */
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
