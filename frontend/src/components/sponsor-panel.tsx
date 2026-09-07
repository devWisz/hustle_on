"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSol, solToLamports } from "@/lib/format";
import { sendSol, walletAvailable, WalletError } from "@/lib/wallet";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { WalletIcon, CheckIcon, SolanaIcon } from "./icons";

interface SponsorIntent {
  sponsorshipId: string;
  payTo: string;
  amount: number;
  cluster: string;
}

const PRESETS = [0.05, 0.25, 1] as const;

type Stage = "idle" | "creating" | "signing" | "confirming" | "done";

/**
 * The sponsorship flow, in three server-verified steps:
 *
 *   1. The API records the intent and returns the creator's payout address.
 *      The destination comes from the server, never from this component.
 *   2. The wallet signs and sends the transfer.
 *   3. The API verifies the signature against the cluster before crediting.
 *
 * If the tab closes between 2 and 3 the background reconciler settles it, so a
 * sponsor is never charged without the creator being credited.
 */
export function SponsorPanel({
  creatorHandle,
  creatorName,
  videoId,
  hasWallet,
}: {
  creatorHandle: string;
  creatorName: string;
  videoId?: string;
  hasWallet: boolean;
}) {
  const [amount, setAmount] = useState("0.25");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  // Checked after mount: the injected wallet does not exist during server
  // rendering, and reading it in render would cause a hydration mismatch.
  const [hasExtension, setHasExtension] = useState(true);

  useEffect(() => setHasExtension(walletAvailable()), []);

  const lamports = solToLamports(Number(amount) || 0);
  const busy = stage === "creating" || stage === "signing" || stage === "confirming";

  async function sponsor(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(Number(amount)) || lamports < 1_000_000) {
      setError("Enter at least 0.001 SOL.");
      return;
    }

    try {
      setStage("creating");
      const intent = await api<SponsorIntent>("/v1/sponsorships", {
        body: {
          creatorHandle,
          videoId: videoId ?? "",
          amount: lamports,
          message: message.trim(),
          isAnonymous: anonymous,
        },
      });

      setStage("signing");
      const sent = await sendSol(intent.payTo, intent.amount);
      setSignature(sent.signature);

      // Recorded before confirmation so the reconciler can finish the job even
      // if this tab goes away in the next second.
      await api(`/v1/sponsorships/${intent.sponsorshipId}/signature`, {
        body: { signature: sent.signature, payer: sent.payer },
      }).catch(() => undefined);

      setStage("confirming");
      await api(`/v1/sponsorships/${intent.sponsorshipId}/confirm`, {
        body: {
          signature: sent.signature,
          payer: sent.payer,
          payee: intent.payTo,
          amount: intent.amount,
        },
      });

      setStage("done");
    } catch (err) {
      setStage("idle");
      if (err instanceof WalletError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else setError("The transaction could not be completed. Nothing was charged.");
    }
  }

  if (!hasWallet) {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Sponsor this work</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {creatorName} has not connected a wallet yet, so sponsorships are closed for now.
        </p>
      </Card>
    );
  }

  if (stage === "done") {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-accent">
          <CheckIcon size={18} />
          <h2 className="text-[15px] font-semibold">Sponsorship confirmed</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {formatSol(lamports)} went to {creatorName}. It is settled on chain and cannot be
          reversed.
        </p>
        {signature ? (
          <p className="mt-3 break-all font-mono text-[11px] text-fg-subtle">{signature}</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Sponsor this work</h2>
        <SolanaIcon size={15} className="text-fg-subtle" />
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
        Goes straight to {creatorName}&apos;s wallet. We never hold the funds.
      </p>

      <form onSubmit={sponsor} className="mt-4 space-y-4">
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              aria-pressed={amount === String(preset)}
              className={
                "h-9 flex-1 rounded-[var(--radius-control)] border text-[13px] font-medium transition-colors " +
                (amount === String(preset)
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg")
              }
            >
              {preset} SOL
            </button>
          ))}
        </div>

        <Field label="Amount in SOL" htmlFor="sponsor-amount">
          <Input
            id="sponsor-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-describedby="sponsor-amount-note"
          />
        </Field>

        <Field label="Message" htmlFor="sponsor-message" hint="Optional, up to 280 characters.">
          <Textarea
            id="sponsor-message"
            value={message}
            maxLength={280}
            rows={3}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Say what this work meant to you."
          />
        </Field>

        <label className="flex items-center gap-2.5 text-[13px] text-fg-muted">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--accent)]"
          />
          Sponsor anonymously
        </label>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={busy} className="w-full">
          {!busy ? <WalletIcon size={16} /> : null}
          {stage === "creating"
            ? "Preparing"
            : stage === "signing"
              ? "Confirm in your wallet"
              : stage === "confirming"
                ? "Verifying on chain"
                : `Send ${formatSol(lamports)}`}
        </Button>

        {!hasExtension ? (
          <p id="sponsor-amount-note" className="text-[12px] leading-relaxed text-fg-subtle">
            You will need a Solana wallet extension in this browser to complete the transfer.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
