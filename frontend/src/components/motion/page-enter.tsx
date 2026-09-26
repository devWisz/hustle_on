"use client";

import { useRef } from "react";
import { MOTION, gsap, useGSAP } from "./gsap";

let firstPaint = true;

export function PageEnter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (firstPaint) {
        firstPaint = false;
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(ref.current, { autoAlpha: 0, y: 14, duration: 0.6, clearProps: "all" });
      });
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
