"use client";

import { useCallback, useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "../ui/icons";

export const THEME_EVENT = "sardhana:theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(saved === "light" || saved === "dark" ? saved : system);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener(THEME_EVENT, toggle);
    return () => window.removeEventListener(THEME_EVENT, toggle);
  }, [toggle]);

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
    >
      {theme === null ? (
        <span className="h-4 w-4" />
      ) : theme === "dark" ? (
        <SunIcon size={16} />
      ) : (
        <MoonIcon size={16} />
      )}
    </button>
  );
}
