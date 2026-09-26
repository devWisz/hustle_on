"use client";

import { useRef } from "react";
import { formatCount, formatSol } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "./gsap";

const FORMATTERS = {
  count: formatCount,
  sol: formatSol,
  plain: (n: number) => Math.round(n).toLocaleString(),
  percent: (n: number) => `${Math.round(n)}%`,
} as const;

export function CountUp({
  value,
  format = "count",
  duration = 1.6,
  className,
}: {
  value: number;
  format?: keyof typeof FORMATTERS;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const render = FORMATTERS[format];

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const counter = { v: 0 };
        el.textContent = render(0);
        gsap.to(counter, {
          v: value,
          duration,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
          onUpdate: () => {
            el.textContent = render(format === "sol" ? counter.v : Math.round(counter.v));
          },
          onComplete: () => {
            el.textContent = render(value);
          },
        });
      });
    },
    { dependencies: [value, format] },
  );

  return (
    <span ref={ref} className={className}>
      {render(value)}
    </span>
  );
}
