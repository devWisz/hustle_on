"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OPEN_COOKIE_SETTINGS, readConsent, writeConsent, type Consent } from "@/lib/consent";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { Button } from "../ui/button";

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Consent | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consent = readConsent();
    setCurrent(consent);
    if (!consent) setOpen(true);
    const reopen = () => {
      setCurrent(readConsent());
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
  }, []);

  useGSAP(
    () => {
      if (!open || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(panel.current, { y: 40, autoAlpha: 0, duration: 0.6, ease: "expo.out" });
      });
    },
    { dependencies: [open] },
  );

  function choose(value: Consent) {
    writeConsent(value);
    setCurrent(value);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Cookie settings"
      className="fixed inset-x-3 bottom-3 z-[65] mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-lifted)] sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <p className="text-[15px] font-semibold">Cookies on Sardhana</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
        We use essential cookies to keep you signed in and to protect your account from forged
        requests. With your permission we also remember your theme, recent searches and saved
        sessions on this device. We never use advertising or tracking cookies.{" "}
        <Link href="/cookies" className="font-medium text-fg underline underline-offset-2">
          Cookie policy
        </Link>
      </p>
      {current ? (
        <p className="mt-3 text-[12.5px] text-fg-subtle">
          Current choice: {current === "all" ? "essential and preferences" : "essential only"}.
        </p>
      ) : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => choose("essential")}>
          Essential only
        </Button>
        <Button variant="inverse" onClick={() => choose("all")}>
          Allow preferences
        </Button>
      </div>
    </div>
  );
}
