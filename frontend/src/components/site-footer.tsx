import Link from "next/link";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8 text-[13px] text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-medium text-fg">Sardhana</span> — timelapses of real work, funded by
          the people who want to see more of it.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/about" className="transition-colors hover:text-fg">
            About
          </Link>
          <Link href="/terms" className="transition-colors hover:text-fg">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-fg">
            Privacy
          </Link>
          {/* Donations are real money. Which chain they settle on is not a
              detail to bury, so the cluster is stated on every page. */}
          <span className="tabular-nums text-fg-subtle">Solana {CLUSTER}</span>
        </nav>
      </div>
    </footer>
  );
}
