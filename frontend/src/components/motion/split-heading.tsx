"use client";

import { useRef } from "react";
import { MOTION, REDUCED, SplitText, gsap, useGSAP } from "./gsap";

type Heading = "h1" | "h2" | "h3" | "p";

export function SplitHeading({
  children,
  as: Tag = "h2",
  className,
  delay = 0,
  onScroll = true,
}: {
  children: React.ReactNode;
  as?: Heading;
  className?: string;
  delay?: number;
  onScroll?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        let split: SplitText | undefined;
        document.fonts.ready.then(() => {
          split = SplitText.create(el, {
            type: "lines,words",
            linesClass: "split-line",
            autoSplit: true,
            onSplit(self) {
              gsap.set(el, { autoAlpha: 1 });
              return gsap.from(self.words, {
                yPercent: 110,
                duration: 1.1,
                ease: "expo.out",
                stagger: 0.045,
                delay,
                scrollTrigger: onScroll ? { trigger: el, start: "top 88%", once: true } : undefined,
              });
            },
          });
        });
        return () => split?.revert();
      });
      mm.add(REDUCED, () => {
        gsap.set(el, { autoAlpha: 1 });
      });
    },
    { scope: ref },
  );

  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} data-split="" className={className}>
      {children}
    </Component>
  );
}
