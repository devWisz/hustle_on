"use client";

import { useRef } from "react";
import { ScrollTrigger, gsap, useGSAP } from "../motion/gsap";
import { ArrowUpIcon } from "../ui/icons";

export function ScrollTop() {
  const ref = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    gsap.set(el, { autoAlpha: 0, scale: 0.8 });
    const trigger = ScrollTrigger.create({
      start: 600,
      end: "max",
      onToggle: (self) =>
        gsap.to(el, {
          autoAlpha: self.isActive ? 1 : 0,
          scale: self.isActive ? 1 : 0.8,
          duration: 0.3,
        }),
    });
    return () => trigger.kill();
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="press invisible fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-[var(--shadow-raised)] hover:border-border-strong sm:bottom-6 sm:right-6"
    >
      <ArrowUpIcon size={17} />
    </button>
  );
}
