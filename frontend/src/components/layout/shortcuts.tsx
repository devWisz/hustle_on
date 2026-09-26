"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { CloseIcon } from "../ui/icons";
import { THEME_EVENT } from "./theme-toggle";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘", "K"], description: "Search and jump anywhere" },
  { keys: ["/"], description: "Search" },
  { keys: ["G", "H"], description: "Go home" },
  { keys: ["G", "D"], description: "Go to your dashboard" },
  { keys: ["G", "U"], description: "Go to upload" },
  { keys: ["G", "A"], description: "Go to the admin console" },
  { keys: ["T"], description: "Toggle light and dark" },
  { keys: ["?"], description: "Show this list" },
];

const ROUTES: Record<string, string> = { h: "/", d: "/dashboard", u: "/upload", a: "/admin" };

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const pendingG = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "t") {
        window.dispatchEvent(new Event(THEME_EVENT));
      } else if (e.key === "g") {
        pendingG.current = Date.now();
      } else if (Date.now() - pendingG.current < 900 && ROUTES[e.key]) {
        pendingG.current = 0;
        router.push(ROUTES[e.key]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useGSAP(
    () => {
      if (!open || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(panel.current, { y: 16, autoAlpha: 0, duration: 0.4 });
        gsap.from("li", { x: -10, autoAlpha: 0, stagger: 0.03, duration: 0.4, delay: 0.1 });
      });
    },
    { dependencies: [open], scope: panel },
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-lifted)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="shortcuts-title" className="text-[15px] font-semibold">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="press rounded-full p-1.5 text-fg-subtle hover:bg-surface-raised hover:text-fg"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <ul className="divide-y divide-border px-5">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-fg-muted">{s.description}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <span key={k} className="kbd">
                    {k}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
