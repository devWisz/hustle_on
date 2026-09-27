"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/format";
import { MOTION, ScrollTrigger, gsap, useGSAP } from "../motion/gsap";
import { Avatar } from "../ui/avatar";
import { buttonClass } from "../ui/button";
import { CloseIcon, LogoMark, MenuIcon, SearchIcon } from "../ui/icons";
import { ThemeToggle } from "./theme-toggle";
import { openCommandSearch } from "./command-search";

interface HeaderUser {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  role: "member" | "admin";
}

interface NavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
}

export function HeaderClient({ user, demo }: { user?: HeaderUser; demo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const nav: NavItem[] = [
    { href: "/#feed", label: "Explore", match: (p) => p === "/" || p.startsWith("/watch") },
    { href: "/about", label: "How it works", match: (p) => p === "/about" },
  ];
  if (user || demo)
    nav.push({ href: "/dashboard", label: "Dashboard", match: (p) => p.startsWith("/dashboard") });
  if (user?.role === "admin")
    nav.push({ href: "/admin", label: "Admin", match: (p) => p.startsWith("/admin") });

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useGSAP(() => {
    const el = bar.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const hide = gsap.to(el, {
        yPercent: -100,
        duration: 0.35,
        ease: "power2.out",
        paused: true,
      });
      const trigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate(self) {
          el.dataset.scrolled = self.scroll() > 8 ? "true" : "false";
          if (self.scroll() < 120) hide.reverse();
          else if (self.direction === 1) hide.play();
          else hide.reverse();
        },
      });
      return () => trigger.kill();
    });
  });

  useGSAP(
    () => {
      if (!open || !menu.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap
          .timeline()
          .from(menu.current, { clipPath: "inset(0 0 100% 0)", duration: 0.55, ease: "expo.out" })
          .from(
            "[data-menu-item]",
            { yPercent: 120, autoAlpha: 0, stagger: 0.05, duration: 0.6, ease: "expo.out" },
            "-=0.3",
          );
      });
    },
    { dependencies: [open], scope: menu },
  );

  return (
    <header
      ref={bar}
      data-scrolled="false"
      className="group/header sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-xl transition-colors duration-300 data-[scrolled=true]:border-border"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight"
        >
          <LogoMark />
          <span>Sardhana</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const current = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-[14px] transition-colors",
                  current ? "bg-surface-raised text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={openCommandSearch}
            className="press hidden h-9 items-center gap-2 rounded-full border border-border bg-surface pl-3 pr-1.5 text-[13px] text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted sm:flex"
          >
            <SearchIcon size={14} />
            <span className="pr-6">Search</span>
            <span className="kbd">/</span>
          </button>
          <button
            type="button"
            onClick={openCommandSearch}
            aria-label="Search"
            className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-surface-raised hover:text-fg sm:hidden"
          >
            <SearchIcon size={17} />
          </button>
          <ThemeToggle />

          {user ? (
            <>
              <Link
                href="/upload"
                className={buttonClass("inverse", "sm", "hidden sm:inline-flex")}
              >
                Upload
              </Link>
              <Link
                href={`/creator/${user.handle}`}
                aria-label={`Your profile, ${user.displayName}`}
                className="rounded-full ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-border-strong"
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size={32} />
              </Link>
            </>
          ) : (
            <Link href="/login" className={buttonClass("inverse", "sm", "hidden sm:inline-flex")}>
              Sign in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-surface-raised hover:text-fg md:hidden"
          >
            <MenuIcon size={18} />
          </button>
        </div>
      </div>

      {open
        ? createPortal(
            <div
              ref={menu}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-50 flex h-dvh flex-col bg-bg px-4 pb-8 sm:px-6 md:hidden"
            >
              <div className="flex h-16 items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-2.5 text-[15px] font-semibold"
                  onClick={() => setOpen(false)}
                >
                  <LogoMark />
                  Sardhana
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-surface-raised hover:text-fg"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <nav aria-label="Menu" className="mt-8 flex flex-col">
                {[
                  ...nav,
                  ...(user || demo
                    ? [
                        { href: "/upload", label: "Upload", match: (p: string) => p === "/upload" },
                        {
                          href: "/settings",
                          label: "Settings",
                          match: (p: string) => p === "/settings",
                        },
                      ]
                    : []),
                ].map((item) => (
                  <div key={item.href} className="overflow-hidden border-b border-border">
                    <Link
                      data-menu-item
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={item.match(pathname) ? "page" : undefined}
                      className={cx(
                        "block py-4 text-[2rem] font-semibold tracking-tight",
                        item.match(pathname) ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {item.label}
                    </Link>
                  </div>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3" data-menu-item>
                {user ? (
                  <Link
                    href={`/creator/${user.handle}`}
                    className={buttonClass("secondary", "lg", "w-full")}
                  >
                    Your profile
                  </Link>
                ) : (
                  <Link href="/login" className={buttonClass("inverse", "lg", "w-full")}>
                    Sign in
                  </Link>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
