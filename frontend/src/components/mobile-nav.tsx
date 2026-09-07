"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { navigation } from "./site-header";
import { MenuIcon, CloseIcon } from "./icons";

/** The small-screen navigation. Closed by default, dismissed on Escape. */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // The page behind a full-screen menu must not scroll with it.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-control)] p-2 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-bg md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-14 items-center justify-end px-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-control)] p-2 text-fg-muted hover:text-fg"
              aria-label="Close menu"
              autoFocus
            >
              <CloseIcon />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-control)] px-3 py-3 text-[17px] font-medium hover:bg-surface-raised"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-control)] px-3 py-3 text-[17px] font-medium hover:bg-surface-raised"
            >
              {signedIn ? "Dashboard" : "Sign in"}
            </Link>
            {signedIn ? (
              <Link
                href="/upload"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-control)] px-3 py-3 text-[17px] font-medium hover:bg-surface-raised"
              >
                Upload a session
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
