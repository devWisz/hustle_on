"use client";

import { useRef } from "react";
import { MOTION, REDUCED, gsap, useGSAP } from "./gsap";

type Tag = "div" | "section" | "ul" | "ol" | "li" | "header" | "p" | "dl";

export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  y = 28,
  stagger,
  immediate = false,
  style,
}: {
  children: React.ReactNode;
  as?: Tag;
  className?: string;
  delay?: number;
  y?: number;
  stagger?: number;
  immediate?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const targets = stagger ? Array.from(el.children) : el;
        if (stagger) gsap.set(el, { autoAlpha: 1 });
        gsap.fromTo(
          targets,
          { autoAlpha: 0, y },
          {
            autoAlpha: 1,
            y: 0,
            delay,
            stagger,
            clearProps: "transform",
            scrollTrigger: immediate ? undefined : { trigger: el, start: "top 90%", once: true },
          },
        );
      });
      mm.add(REDUCED, () => {
        gsap.set([el, ...Array.from(el.children)], { autoAlpha: 1 });
      });
    },
    { scope: ref },
  );

  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} data-reveal="" className={className} style={style}>
      {children}
    </Component>
  );
}
