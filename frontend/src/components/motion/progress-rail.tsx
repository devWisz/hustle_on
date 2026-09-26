"use client";

import { useRef } from "react";
import { cx } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "./gsap";

export function ProgressRail({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.fromTo(
          el,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: parent, start: "top 70%", end: "bottom 60%", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <span aria-hidden className={cx("pointer-events-none absolute w-px bg-border", className)}>
      <span ref={ref} className="block h-full w-full origin-top bg-accent" />
    </span>
  );
}
