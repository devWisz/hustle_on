"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./icons";

/**
 * Global keyboard shortcuts.
 *
 * Pressing `?` opens a help modal listing all available shortcuts. The modal
 * only shows when no input element is focused, so typing a question mark into
 * a form field works as expected.
 */

interface Shortcut {
  key: string;
  label: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "/", label: "/", description: "Open search" },
  { key: "?", label: "?", description: "Show keyboard shortcuts" },
  { key: "t", label: "t", description: "Toggle theme" },
  { key: "h", label: "h", description: "Go to home page" },
  { key: "u", label: "u", description: "Go to upload page" },
  { key: "d", label: "d", description: "Go to dashboard" },
];

export function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip when an input element is focused.
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
        case "t": {
          e.preventDefault();
          const themeBtn = document.querySelector<HTMLButtonElement>(
            'button[aria-label*="theme"]',
          );
          themeBtn?.click();
          break;
        }
        case "h":
          e.preventDefault();
          window.location.href = "/";
          break;
        case "u":
          e.preventDefault();
          window.location.href = "/upload";
          break;
        case "d":
          e.preventDefault();
          window.location.href = "/dashboard";
          break;
        case "Escape":
          if (showHelp) setShowHelp(false);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp]);

  if (!showHelp) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 drawer-overlay"
        onClick={() => setShowHelp(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md overflow-hidden rounded-[var(--radius-panel)]
                     border border-border bg-surface shadow-[var(--shadow-raised)]
                     animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="rounded-[var(--radius-control)] p-1.5 text-fg-subtle transition-colors hover:bg-surface-raised hover:text-fg"
              aria-label="Close"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <ul className="divide-y divide-border px-5">
            {SHORTCUTS.map((s) => (
              <li key={s.key} className="flex items-center justify-between py-3">
                <span className="text-sm text-fg-muted">{s.description}</span>
                <kbd
                  className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md
                             border border-border bg-surface-raised px-1.5 font-mono text-[12px]
                             text-fg-muted"
                >
                  {s.label}
                </kbd>
              </li>
            ))}
          </ul>

          <div className="border-t border-border px-5 py-3">
            <p className="text-[12px] text-fg-subtle">
              Press <kbd className="rounded border border-border bg-surface-raised px-1 py-0.5 font-mono text-[10px]">?</kbd> to toggle this panel
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
