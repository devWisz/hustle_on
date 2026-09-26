"use client";

import { useRef } from "react";
import { MOTION, gsap, useGSAP } from "./gsap";

export function ScrollScale({
  children,
  from = 0.88,
  className,
}: {
  children: React.ReactNode;
  from?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(`${MOTION} and (min-width: 768px)`, () => {
        gsap.fromTo(
          el,
          { scale: from },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 95%", end: "top 25%", scrub: 0.6 },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className} style={{ transformOrigin: "50% 0%" }}>
      {children}
    </div>
  );
}
