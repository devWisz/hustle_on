"use client";

import { useRef } from "react";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { SearchIcon } from "../ui/icons";
import { openCommandSearch } from "./command-search";

export function NotFoundDigits() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.set(ref.current, { autoAlpha: 1 });
        gsap
          .timeline()
          .from("[data-digit]", {
            yPercent: 120,
            rotate: 8,
            stagger: 0.09,
            duration: 1.1,
            ease: "expo.out",
          })
          .to(
            "[data-digit='1']",
            { rotate: -6, yPercent: 6, duration: 0.5, ease: "back.out(3)" },
            "-=0.2",
          )
          .to("[data-digit='1']", {
            yPercent: -4,
            duration: 2.4,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      data-reveal=""
      aria-hidden
      className="flex select-none overflow-hidden font-semibold leading-[0.8] tracking-[-0.07em] text-[clamp(7rem,30vw,20rem)]"
    >
      {["4", "0", "4"].map((d, i) => (
        <span
          key={i}
          data-digit={i}
          className={i === 1 ? "inline-block text-accent" : "inline-block"}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function SearchInstead() {
  return (
    <button
      type="button"
      onClick={openCommandSearch}
      className="press group flex h-12 w-full items-center gap-3 rounded-full border border-border bg-surface pl-4 pr-2 text-left text-[15px] text-fg-subtle transition-colors hover:border-border-strong sm:max-w-md"
    >
      <SearchIcon size={17} />
      <span className="flex-1">Search sessions and creators</span>
      <span className="kbd">/</span>
    </button>
  );
}
