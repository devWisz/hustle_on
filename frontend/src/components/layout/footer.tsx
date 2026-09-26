import Link from "next/link";
import { GitHubIcon, XIcon } from "./icons";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      {/* Gradient accent line */}
      <div className="gradient-divider" />

      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <p className="text-[15px] font-semibold text-fg">Sardhana</p>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              Timelapses of real work, funded by the people who want to see more of it.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://github.com/sardhana"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg-subtle transition-colors hover:text-fg"
                aria-label="GitHub"
              >
                <GitHubIcon size={16} />
              </a>
              <a
                href="https://x.com/sardhana"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg-subtle transition-colors hover:text-fg"
                aria-label="X"
              >
                <XIcon size={16} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[13px] font-medium text-fg-muted uppercase tracking-wider">
              Navigate
            </p>
            <nav aria-label="Footer navigation" className="mt-3 space-y-2">
              <FooterLink href="/">Timelapses</FooterLink>
              <FooterLink href="/about">How it works</FooterLink>
              <FooterLink href="/upload">Upload</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
            </nav>
          </div>

          {/* Legal & Network */}
          <div>
            <p className="text-[13px] font-medium text-fg-muted uppercase tracking-wider">
              Legal
            </p>
            <nav aria-label="Legal" className="mt-3 space-y-2">
              <FooterLink href="/terms">Terms of service</FooterLink>
              <FooterLink href="/privacy">Privacy policy</FooterLink>
            </nav>
            <div className="mt-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[11px] font-medium tabular-nums text-fg-subtle">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Solana {CLUSTER}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="text-[12px] text-fg-subtle">
            Built for creators who show their work.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block text-[13px] text-fg-subtle transition-colors hover:text-fg"
    >
      {children}
    </Link>
  );
}
