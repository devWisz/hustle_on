"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount, formatSol } from "@/lib/format";

/**
 * Counts a number up when it first scrolls into view.
 *
 * `format` names a formatter rather than being one: this renders inside server
 * components, and a function cannot cross that boundary. The value shown is
 * always put through the named formatter, so the animation cannot invent a
 * shape the real figure would not have — "1.2K" counts through "0.3K", never
 * through a raw 312 — and the last frame is the exact target, so nothing lands
 * on a number that is off by one.
 */
const FORMATTERS = {
  count: formatCount,
  sol: formatSol,
  plain: (n: number) => n.toLocaleString(),
} as const;

export function CountUp({
  value,
  format = "count",
  durationMs = 1100,
  className,
}: {
  value: number;
  format?: keyof typeof FORMATTERS;
  durationMs?: number;
  className?: string;
}) {
  const render = FORMATTERS[format];
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || !("IntersectionObserver" in window)) {
      setShown(value);
      setStarted(true);
      return;
    }

    setShown(0);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setStarted(true);

        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          // Ease-out cubic: fast first, so the number is readable early and
          // only the last few percent are spent settling.
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(t === 1 ? value : Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        node.dataset.frame = String(frame);
      },
      { threshold: 0.4 },
    );

    io.observe(node);
    return () => {
      io.disconnect();
      const frame = Number(node.dataset.frame);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {render(started ? shown : value)}
    </span>
  );
}
