"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ShieldIcon } from "./icons";
import { cx } from "@/lib/format";

/**
 * The hero illustration: a mock recording panel over a mock donation feed.
 *
 * It is decoration, so the whole thing is `aria-hidden` — a screen reader
 * gets the headline and the real feed below, not a fictional session. It also
 * animates on a timer, which means two rules: nothing here may shift layout
 * (every row is a fixed height, so the panel cannot jump while somebody is
 * reading the copy beside it), and everything stops for reduced motion.
 */

interface DemoDonation {
  name: string;
  action: string;
  amount: string;
  time: string;
}

const DEMO_DONATIONS: DemoDonation[] = [
  { name: "@sarjak", action: "Building the Next.js app shell", amount: "1.5 SOL", time: "2m ago" },
  { name: "@alex_code", action: "Refactoring the Go auth engine", amount: "0.8 SOL", time: "8m ago" },
  { name: "@dev_sam", action: "Solana wallet verification", amount: "2.4 SOL", time: "15m ago" },
];

const SPEEDS = ["1x", "4x", "16x", "64x"] as const;

export function HeroVisual() {
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("16x");
  const [index, setIndex] = useState(0);
  const [entering, setEntering] = useState(false);
  const still = useReducedMotion();

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % DEMO_DONATIONS.length);
      // Re-triggers the row's entrance by remounting it via `key` below.
      setEntering(true);
    }, 3800);
    return () => clearInterval(timer);
  }, [still]);

  const current = DEMO_DONATIONS[index] ?? DEMO_DONATIONS[0]!;

  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-lg lg:max-w-none"
    >
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-4 shadow-[var(--shadow-raised)] sm:p-5">
        {/* Panel header */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cx(
                "h-2 w-2 shrink-0 rounded-full bg-danger",
                still ? "" : "animate-blink",
              )}
            />
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              Recorded session
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
            <ShieldIcon size={12} />
            Reviewed
          </span>
        </div>

        {/* Editor mock. Deliberately dark in both themes — it is a picture of a
            code editor, not a surface of this product. */}
        <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[#23262d] bg-[#0d1017] p-3.5 font-mono text-[11px] sm:p-4 sm:text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#23262d] pb-2 text-[10px] text-[#8b93a7]">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#e06c75]/80" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#e5c07b]/80" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#98c379]/80" />
              <span className="ml-1.5 truncate font-sans text-[#c8cedd]">
                app/page.tsx
              </span>
            </div>
            <span className="tnum shrink-0 font-semibold text-[#5ec49a]">{speed}</span>
          </div>

          <div className="mt-3 space-y-1.5 text-[#c8cedd]">
            <CodeLine n="01">
              <span className="text-[#c678dd]">export async function</span>{" "}
              <span className="font-semibold text-[#61afef]">PublishWork</span>() {"{"}
            </CodeLine>
            <CodeLine n="02">
              <span className="pl-3.5 inline-block">
                <span className="text-[#c678dd]">const</span> proof ={" "}
                <span className="text-[#c678dd]">await</span> humanReview();
              </span>
            </CodeLine>
            <CodeLine n="03" highlight>
              <span className="text-[#98c379]">
                <span className="text-[#c678dd]">return</span> transfer(proof.wallet);
              </span>
              <span className="ml-0.5 inline-block w-[1px] self-stretch bg-[#98c379] align-middle animate-[caret_1.1s_step-end_infinite]">
                &nbsp;
              </span>
            </CodeLine>
            <CodeLine n="04">{"}"}</CodeLine>
          </div>

          {/* Playback scrubber. Its fill is set once from the chosen speed, so
              it reads as a position rather than an endless loading bar. */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#23262d]">
              <div
                className="h-full origin-left rounded-full bg-[#5ec49a] transition-transform duration-700 ease-out"
                style={{ transform: `scaleX(${(SPEEDS.indexOf(speed) + 1) / SPEEDS.length})` }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-[#23262d] bg-[#14171e] p-0.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  tabIndex={-1}
                  className={cx(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    s === speed
                      ? "bg-[#5ec49a] text-[#0d1017]"
                      : "text-[#8b93a7] hover:text-[#c8cedd]",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Donation feed. Fixed height so the rotation never nudges the page. */}
        <div className="mt-4 flex h-[62px] items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface-raised px-3.5">
          <div
            key={index}
            className={cx("flex min-w-0 items-center gap-3", entering && "animate-fade-in")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-fg">
              SOL
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-semibold">{current.name}</span>
                <span className="shrink-0 text-[10px] text-fg-subtle">{current.time}</span>
              </div>
              <p className="truncate text-[11px] text-fg-muted">{current.action}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="tnum text-[12px] font-bold text-accent">+{current.amount}</div>
            <span className="flex items-center justify-end gap-0.5 text-[10px] font-medium text-fg-subtle">
              <CheckIcon size={10} /> Direct
            </span>
          </div>
        </div>

        {/* Three claims, stated flat. */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Claim value="100%" label="Human reviewed" />
          <Claim value="0%" label="Platform cut" />
          <Claim value="Direct" label="Wallet to wallet" accent />
        </div>
      </div>
    </div>
  );
}

function CodeLine({
  n,
  children,
  highlight,
}: {
  n: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex gap-3",
        highlight && "-mx-3.5 border-l-2 border-[#5ec49a] bg-[#5ec49a]/10 px-3.5 py-0.5 sm:-mx-4 sm:px-4",
      )}
    >
      <span className="shrink-0 select-none text-[#4b5263]">{n}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Claim({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface-raised px-1.5 py-2">
      <div className={cx("text-[12px] font-semibold", accent ? "text-accent" : "text-fg")}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-fg-muted">{label}</div>
    </div>
  );
}

/** Tracks the reduced-motion preference, including a change made while open. */
function useReducedMotion() {
  const [still, setStill] = useState(false);
  const mq = useRef<MediaQueryList>(null);

  useEffect(() => {
    mq.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.current.matches);
    const onChange = (e: MediaQueryListEvent) => setStill(e.matches);
    mq.current.addEventListener("change", onChange);
    return () => mq.current?.removeEventListener("change", onChange);
  }, []);

  return still;
}
