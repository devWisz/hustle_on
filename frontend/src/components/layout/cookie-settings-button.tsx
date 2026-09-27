"use client";

import { openCookieSettings } from "@/lib/consent";
import { cx } from "@/lib/format";
import { buttonClass } from "../ui/button";

export function CookieSettingsButton({ variant = "button" }: { variant?: "button" | "link" }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={cx(
        variant === "link"
          ? "link-underline text-sm text-fg-muted hover:text-fg"
          : buttonClass("secondary", "md"),
      )}
    >
      Cookie settings
    </button>
  );
}
