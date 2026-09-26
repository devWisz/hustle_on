"use client";

import { useEffect } from "react";

/**
 * Marks the document as hydrated.
 *
 * The boot script in the document head hides every scroll-reveal element and
 * arms a timer to un-hide them again. This is the signal that cancels that
 * timer: it can only run once React is actually alive on the page, so a bundle
 * that never loads — or is blocked by a policy, or throws during hydration —
 * leaves the mark unset and the content is shown anyway. It renders nothing.
 */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "");
  }, []);

  return null;
}
