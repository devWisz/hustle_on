"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "../ui";

/**
 * What the button says while it works. Each of these is a distinct thing the
 * wallet is doing, and naming them is the difference between a wait that feels
 * like progress and one that feels like a hang — the signature prompt in
 * particular appears in a different window, so it has to be announced.
 */
type Step = "idle" | "connecting" | "signing" | "verifying";

const LABELS: Record<Step, string> = {
  idle: "Connect wallet",
  connecting: "Opening your wallet…",
  signing: "Waiting for your signature…",
  verifying: "Verifying…",
};

interface Challenge {
  message: string;
  nonce: string;
  issuedAt: string;
}

/**
 * Sign in with a Solana wallet.
 *
 * There is no password step and no sign-up step, because a signature already
 * proves the only thing either of them would be establishing: that the person at
 * the keyboard holds the key. The server verifies the signature and, if the
 * address has never been seen, creates the account in the same request.
 */
export function WalletSignIn({ next, className }: { next?: string; className?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  // Absent until the effect runs, so the server-rendered markup does not claim a
  // wallet is missing when the check simply has not happened yet.
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  // Whether a wallet exists is asked of the browser, so the module that knows how
  // to talk to one is imported only here and only in the browser. Importing it at
  // the top of the file would put the whole Solana client — a couple of hundred
  // kilobytes — into the bundle for a page most visitors leave immediately.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/wallet").then(({ walletAvailable }) => {
      if (!cancelled) setHasWallet(walletAvailable());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      setStep("connecting");
      const { connectWallet, signOwnershipProof } = await import("@/lib/wallet");
      const address = await connectWallet();

      // One retry, and only for an expired challenge: the common cause is a
      // wallet prompt left open while the nonce aged out, and asking the person
      // to press the button again would be asking them to fix our timeout.
      for (let attempt = 0; ; attempt++) {
        setStep("signing");
        const challenge = await api<Challenge>("/v1/auth/signin/challenge", {
          body: { address },
        });
        const signature = await signOwnershipProof(challenge.message);

        setStep("verifying");
        try {
          await api("/v1/auth/signin/verify", {
            body: {
              address,
              nonce: challenge.nonce,
              signature,
              issuedAt: challenge.issuedAt,
            },
          });
          break;
        } catch (err) {
          if (attempt === 0 && err instanceof ApiError && err.status === 400) continue;
          throw err;
        }
      }

      setStep("idle");
      // The session lives in a cookie the server set on that response, so the
      // server-rendered pages have to be re-fetched rather than only navigated.
      router.push(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setStep("idle");
      setError(describe(err));
    }
  }, [next, router]);

  if (hasWallet === false) {
    return (
      <div className={className}>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <p className="text-[15px] font-medium">No Solana wallet found</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
            Signing in is a signature from a wallet, so one has to be installed first.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://phantom.app/download"
              target="_blank"
              rel="noreferrer noopener"
              className="link-underline text-[13.5px] font-medium"
            >
              Get Phantom
            </a>
            <Link href="/" className="link-underline text-[13.5px] text-fg-muted">
              Keep browsing instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        size="lg"
        className="w-full"
        loading={step !== "idle"}
        disabled={hasWallet === null}
        onClick={() => void signIn()}
      >
        {LABELS[step]}
      </Button>

      {error && (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      )}

      <p className="mt-3 text-[12.5px] leading-relaxed text-fg-subtle">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
          Privacy Policy
        </Link>
        . Signing in is free and moves no funds.
      </p>
    </div>
  );
}

/**
 * Turns a failure into something the person can act on.
 *
 * The wallet's own rejection is separated from ours deliberately: "you cancelled"
 * and "we could not reach the server" call for different next actions, and a
 * single generic message for both sends people to the wrong one.
 */
function describe(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "That sign-in request expired before it was signed. Try again.";
      case 401:
        return "That signature does not match the wallet. Try again, and approve the exact message your wallet shows.";
      case 403:
        return "This account is suspended.";
      case 429:
        return "Too many sign-in attempts from this connection. Wait a minute and try again.";
      default:
        return err.message || "Sign-in failed. Try again.";
    }
  }
  if (isUserRejection(err)) {
    return "Signature cancelled. Nothing happened, and you can try again whenever you like.";
  }
  if (err instanceof TypeError) {
    return "Could not reach the sign-in service. Check your connection, or that the API is running.";
  }
  return "Sign-in failed. Try again.";
}

/** Wallets signal "the person pressed cancel" with code 4001, among other shapes. */
function isUserRejection(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 4001 || code === "4001";
}
