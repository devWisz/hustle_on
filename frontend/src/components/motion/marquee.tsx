"use client";

import { useRef } from "react";
import { cx } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "./gsap";

export function Marquee({
  children,
  speed = 40,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = track.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const width = el.scrollWidth / 2;
        const tween = gsap.to(el, {
          x: -width,
          duration: width / speed,
          ease: "none",
          repeat: -1,
        });
        const slow = () => gsap.to(tween, { timeScale: 0.2, duration: 0.6 });
        const resume = () => gsap.to(tween, { timeScale: 1, duration: 0.6 });
        const node = root.current;
        node?.addEventListener("pointerenter", slow);
        node?.addEventListener("pointerleave", resume);
        return () => {
          node?.removeEventListener("pointerenter", slow);
          node?.removeEventListener("pointerleave", resume);
        };
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={cx("fade-edges overflow-hidden", className)}>
      <div ref={track} className="flex w-max">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
