"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "../ui";

/**
 * What the wallet is doing, named. Each of these is a distinct wait and the
 * signature prompt in particular appears in a different window, so a single
 * "Please wait" would leave people staring at an unchanged page while their wallet
 * is asking them a question.
 */
type Step = "idle" | "connecting" | "signing" | "verifying";

const LABELS: Record<Step, string> = {
  idle: "",
  connecting: "Opening your wallet…",
  signing: "Waiting for your signature…",
  verifying: "Verifying…",
};

interface Challenge {
  message: string;
  nonce: string;
  issuedAt: string;
}

interface Detected {
  id: string;
  name: string;
}

/**
 * Sign in by proving you hold a wallet key.
 *
 * The wallet is chosen rather than guessed. A browser can have several installed,
 * and silently reaching for whichever one answered first is how people end up
 * signing in as an account they had forgotten they had — or being told they have
 * no wallet when the one they use is simply not the one we looked for.
 */
export function WalletSignIn({ next, className }: { next?: string; className?: string }) {
  const router = useRouter();
  const [wallets, setWallets] = useState<Detected[] | null>(null);
  const [installs, setInstalls] = useState<{ name: string; install: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  // Which wallets exist is a question for the browser, so the module that knows how
  // to talk to one is imported here and only here. A static import would put the
  // whole Solana client — a couple of hundred kilobytes — into a page most visitors
  // leave immediately.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/wallet").then(({ detectWallets, installableWallets }) => {
      if (cancelled) return;
      setWallets(detectWallets().map(({ id, name }) => ({ id, name })));
      setInstalls(installableWallets());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (walletId: string) => {
      setError(null);
      setActive(walletId);
      try {
        const { selectWallet, connectWallet, signOwnershipProof } = await import("@/lib/wallet");
        if (!selectWallet(walletId)) throw new Error("That wallet is no longer available.");

        setStep("connecting");
        const address = await connectWallet();

        // One retry, and only for an expired challenge: the usual cause is a wallet
        // prompt left open while the nonce aged out, and asking somebody to press
        // the button again to fix our timeout is not a fix.
        for (let attempt = 0; ; attempt++) {
          setStep("signing");
          const challenge = await api<Challenge>("/v1/auth/signin/challenge", {
            body: { address },
          });
          const signature = await signOwnershipProof(challenge.message);

          setStep("verifying");
          try {
            await api("/v1/auth/signin/verify", {
              body: { address, nonce: challenge.nonce, signature, issuedAt: challenge.issuedAt },
            });
            break;
          } catch (err) {
            if (attempt === 0 && err instanceof ApiError && err.status === 400) continue;
            throw err;
          }
        }

        setStep("idle");
        setActive(null);
        // The session lives in a cookie the server set on that response, so
        // server-rendered pages have to be re-fetched rather than only navigated.
        router.push(next ?? "/dashboard");
        router.refresh();
      } catch (err) {
        setStep("idle");
        setActive(null);
        setError(describe(err));
      }
    },
    [next, router],
  );

  if (wallets === null) {
    // Nothing is claimed until the browser has actually been asked.
    return <div className={className} />;
  }

  if (wallets.length === 0) {
    return (
      <div className={className}>
        <p className="text-[13.5px] leading-relaxed text-fg-muted">
          No Solana wallet found in this browser. Install one and reload — or use the email form
          above, which needs no wallet at all.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {installs.map((w) => (
            <a
              key={w.name}
              href={w.install}
              target="_blank"
              rel="noreferrer noopener"
              className="link-underline text-[13.5px] font-medium"
            >
              Get {w.name}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <li key={w.id}>
            <Button
              type="button"
              variant="secondary"
              loading={active === w.id && step !== "idle"}
              disabled={step !== "idle"}
              onClick={() => void signIn(w.id)}
            >
              {active === w.id && step !== "idle" ? LABELS[step] : w.name}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Turns a failure into something the person can act on.
 *
 * A cancelled signature and an unreachable server call for different next actions,
 * and one generic message for both sends people to the wrong one.
 */
function describe(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "That sign-in request expired before it was signed. Try again.";
      case 401:
        return "That signature does not match the wallet. Approve the exact message your wallet shows.";
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
  if (err instanceof Error && err.message) return err.message;
  return "Sign-in failed. Try again.";
}

/** Wallets signal "the person pressed cancel" with code 4001, among other shapes. */
function isUserRejection(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 4001 || code === "4001";
}
