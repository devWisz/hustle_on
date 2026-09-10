"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./icons";

/**
 * A floating button that appears after the visitor has scrolled past the fold.
 *
 * It uses smooth scrolling (the CSS `scroll-behavior: smooth` on `html`)
 * rather than a JS scroll call, so the motion matches every other anchor
 * navigation on the site.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center
                 rounded-full bg-accent text-accent-fg shadow-[var(--shadow-raised)]
                 transition-all duration-300 hover:bg-accent-hover hover:shadow-[var(--shadow-glow)]
                 animate-scale-in"
      aria-label="Scroll to top"
    >
      <ArrowUpIcon size={18} />
    </button>
  );
}
