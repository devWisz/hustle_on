import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { GitHubIcon, LogoMark, XIcon } from "../ui/icons";
import { CookieSettingsButton } from "./cookie-settings-button";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#feed", label: "Explore" },
      { href: "/about", label: "How it works" },
      { href: "/upload", label: "Upload" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/terms", label: "Terms and Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border sm:mt-32">
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold">
              <LogoMark />
              {SITE_NAME}
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-muted">
              Timelapses of real work, reviewed by a person and funded directly by the people who
              want to see more of it.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <a
                href="https://github.com/hustleon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="press flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                <GitHubIcon size={15} />
              </a>
              <a
                href="https://x.com/hustleon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="press flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                <XIcon size={14} />
              </a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-eyebrow">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="link-underline text-sm text-fg-muted hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p
          aria-hidden
          className="mt-16 select-none text-[clamp(3.5rem,17vw,15rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-fg/[0.07]"
        >
          {SITE_NAME}
        </p>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 text-[12.5px] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{SITE_TAGLINE}</span>
            <CookieSettingsButton variant="link" />
          </p>
          <p className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              Solana {CLUSTER}
            </span>
            <span>
              Press <span className="kbd">?</span> for shortcuts
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
