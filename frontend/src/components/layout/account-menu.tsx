"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { cx } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { Avatar } from "../ui/avatar";
import { ChevronDownIcon } from "../ui/icons";

interface AccountUser {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  role: "member" | "admin";
}

export function AccountMenu({ user }: { user: AccountUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const links = [
    { href: `/creator/${user.handle}`, label: "Your profile" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/upload", label: "Upload a timelapse" },
    { href: "/settings", label: "Settings" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin console" }] : []),
  ];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [],
        );
        const at = items.indexOf(document.activeElement as HTMLElement);
        const step = e.key === "ArrowDown" ? 1 : -1;
        items[(at + step + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap
          .timeline()
          .from(panel.current, {
            autoAlpha: 0,
            y: -6,
            scale: 0.97,
            transformOrigin: "top right",
            duration: 0.28,
            ease: "power3.out",
          })
          .from(
            "[data-account-item]",
            { autoAlpha: 0, y: -4, stagger: 0.03, duration: 0.25, ease: "power2.out" },
            "-=0.18",
          );
      });
    },
    { dependencies: [open], scope: root },
  );

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/v1/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.displayName}`}
        className="press flex items-center gap-1 rounded-full p-0.5 pr-1.5 text-fg-subtle transition-colors hover:bg-surface-raised hover:text-fg"
      >
        <Avatar name={user.displayName} src={user.avatarUrl} size={30} />
        <ChevronDownIcon
          size={14}
          className={cx("transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          ref={panel}
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          <div data-account-item className="border-b border-border px-4 py-3.5">
            <p className="truncate text-[14px] font-semibold">{user.displayName}</p>
            <p className="truncate text-[12.5px] text-fg-muted">@{user.handle}</p>
          </div>
          <div className="p-1.5">
            {links.map((link) => (
              <Link
                key={link.href}
                data-account-item
                role="menuitem"
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cx(
                  "block rounded-[var(--radius-control)] px-3 py-2 text-[13.5px] transition-colors hover:bg-surface-raised hover:text-fg focus-visible:bg-surface-raised focus-visible:outline-none",
                  pathname === link.href ? "text-fg" : "text-fg-muted",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border p-1.5">
            <button
              data-account-item
              role="menuitem"
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="block w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-[13.5px] text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg focus-visible:bg-surface-raised focus-visible:outline-none disabled:opacity-50"
            >
              {signingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
