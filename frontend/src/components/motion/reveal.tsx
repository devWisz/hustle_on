"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/format";

/**
 * Reveals its children as they scroll into view.
 *
 * One shared IntersectionObserver watches every `[data-reveal]` element on the
 * page, rather than one observer per component: the number of these on a long
 * feed is unbounded, and a few hundred observers is the difference between a
 * smooth scroll and a janky one. The motion itself lives in CSS
 * (`[data-reveal]` in globals.css), so nothing animates from JavaScript.
 *
 * Elements are unobserved once revealed — this is an entrance, not a scroll
 * effect, and content must not disappear again when it leaves the viewport.
 */

type Direction = "up" | "left" | "right" | "scale";

let observer: IntersectionObserver | null = null;
/** Elements mounted before the observer existed (SSR hydration, or an early effect). */
const pending = new Set<Element>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return null;
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "");
        observer?.unobserve(entry.target);
        pending.delete(entry.target);
      }
    },
    // Fires a little before the element's top edge arrives, so the transition
    // has finished by the time it is properly on screen.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
  );
  return observer;
}

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  direction?: Direction;
  /** Milliseconds to hold before this element moves. Stagger a row with it. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // A visitor who has asked for reduced motion gets the finished state with
    // no observer at all.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      node.setAttribute("data-revealed", "");
      return;
    }

    const io = ensureObserver();
    if (!io) {
      // No IntersectionObserver: show everything rather than hide it.
      node.setAttribute("data-revealed", "");
      return;
    }

    io.observe(node);
    pending.add(node);
    return () => {
      io.unobserve(node);
      pending.delete(node);
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-reveal={direction}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={cx(className)}
    >
      {children}
    </Tag>
  );
}
