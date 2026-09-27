"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";
import {
  AlertIcon,
  CoinsIcon,
  FilmIcon,
  GridIcon,
  InboxIcon,
  ListIcon,
  MessageSquareIcon,
  UsersIcon,
} from "../ui/icons";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: GridIcon, key: "overview" },
  { href: "/admin/queue", label: "Review desk", icon: InboxIcon, key: "queue" },
  { href: "/admin/reports", label: "Reports", icon: AlertIcon, key: "reports" },
  { href: "/admin/library", label: "Library", icon: FilmIcon, key: "library" },
  { href: "/admin/members", label: "Members", icon: UsersIcon, key: "members" },
  { href: "/admin/ledger", label: "Ledger", icon: CoinsIcon, key: "ledger" },
  { href: "/admin/notes", label: "Notes", icon: MessageSquareIcon, key: "notes" },
  { href: "/admin/audit", label: "Audit trail", icon: ListIcon, key: "audit" },
] as const;

export function AdminNav({
  counts,
}: {
  counts: Partial<Record<(typeof ITEMS)[number]["key"], number>>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="scroll-x -mx-4 flex gap-1 px-4 lg:mx-0 lg:flex-col lg:px-0">
      {ITEMS.map((item) => {
        const current =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const count = counts[item.key];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "press flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-[13.5px] transition-colors lg:rounded-[var(--radius-control)]",
              current
                ? "bg-inverse text-inverse-fg"
                : "text-fg-muted hover:bg-surface-raised hover:text-fg",
            )}
          >
            <item.icon size={16} />
            <span className="flex-1">{item.label}</span>
            {count ? (
              <span
                className={cx(
                  "rounded-full px-1.5 font-mono text-[11px] tabular-nums",
                  current
                    ? "bg-inverse-fg/15"
                    : item.key === "queue"
                      ? "bg-warning-soft text-warning"
                      : "bg-surface-raised",
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
