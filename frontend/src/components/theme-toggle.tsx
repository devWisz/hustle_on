"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark" | "system";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("theme") as Theme | null) ?? "system";

    const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialResolved = saved === "system" ? (isSystemDark ? "dark" : "light") : saved;
    setResolvedTheme(initialResolved);

    if (saved === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", saved);
    }

    const listener = (e: MediaQueryListEvent) => {
      if ((localStorage.getItem("theme") ?? "system") === "system") {
        const next = e.matches ? "dark" : "light";
        setResolvedTheme(next);
      }
    };
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  function toggle() {
    const next: "light" | "dark" = resolvedTheme === "dark" ? "light" : "dark";
    setResolvedTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className={
          className ??
          "flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        }
        aria-label="Toggle theme"
      >
        <span className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
      }
      aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolvedTheme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );
}
