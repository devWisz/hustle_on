import Link from "next/link";
import { XIcon, GitHubIcon } from "./icons";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/discover", label: "Discover" },
      { href: "/hire", label: "Hire talent" },
      { href: "/jobs", label: "Open roles" },
      { href: "/upload", label: "Publish a session" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/security", label: "Security" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <p className="text-[15px] font-semibold tracking-tight">HustlerOn</p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Your hustle should be paid off. Publish the work, collect the support, get hired on
              the record.
            </p>
            <div className="mt-4 flex items-center gap-3 text-fg-subtle">
              <a
                href="https://x.com/hustleron"
                className="transition-colors hover:text-fg"
                rel="me noreferrer"
                target="_blank"
              >
                <XIcon />
              </a>
              <a
                href="https://github.com/hustleron"
                className="transition-colors hover:text-fg"
                rel="me noreferrer"
                target="_blank"
              >
                <GitHubIcon />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[13px] font-medium text-fg">{column.title}</h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-fg-muted transition-colors hover:text-fg">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-[13px] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HustlerOn</p>
          <p>Payments settle on Solana. Sponsorships are final once confirmed on chain.</p>
        </div>
      </div>
    </footer>
  );
}
