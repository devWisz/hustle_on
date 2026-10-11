import Link from "next/link";
import { cx } from "@/lib/format";
import type { AdminMember } from "@/lib/types";
import { ArrowRightIcon } from "../ui/icons";

/**
 * The composition pieces every admin page shares.
 *
 * None of these decide anything about the work; they exist so that nine pages
 * cannot drift into nine slightly different headers, cards and empty frames. The
 * admin console is one surface with one visual language, and this file is where
 * that language is written down.
 */

/** The header every admin page opens with. */
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,1.3rem+1.2vw,2.25rem)] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * A page body: the shared header, then the content under it at one fixed gap.
 * Every admin page goes through this, so a page can never be flush against its
 * own header or invent its own spacing.
 */
export function AdminPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <AdminHeader title={title} description={description} action={action} />
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

/**
 * The lined surface that holds a set of things.
 *
 * The border and radius are fixed here so lists cannot each pick their own. With
 * `rows` the children are separated by hairlines, which is what every list in the
 * console wants; a table keeps its own internal divisions and uses the plain
 * panel. `label` names the landmark when it is a section, so the region is
 * announced by its heading rather than as an untitled block.
 */
export function Panel({
  children,
  className,
  padded = false,
  rows = false,
  as: Tag = "div",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  rows?: boolean;
  as?: "div" | "section" | "ul" | "ol" | "form";
  label?: string;
}) {
  const named = Tag === "section" && label ? { "aria-labelledby": label } : {};
  return (
    <Tag
      {...named}
      className={cx(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface",
        padded && "p-5 sm:p-6",
        rows && "divide-y divide-border",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** One line inside a `Panel rows`, at the padding that panel expects. */
export const rowPad = "px-4 py-4 sm:px-5";

/**
 * A number that answers a question, and the link to go and act on it.
 *
 * The whole tile is one link, so it is a single tab stop and readable as one
 * thing ("Submissions waiting 3"). A zero is shown like any other number: a tile
 * that disappears when it reaches zero makes the operator wonder whether it was
 * ever counted.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  cta = "Open",
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  href?: string;
  cta?: string;
}) {
  const body = (
    <>
      <dt className="text-[12.5px] text-fg-muted">{label}</dt>
      <dd className="tnum mt-3 text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] font-semibold leading-none tracking-tight">
        {value}
      </dd>
      <p className="mt-2 text-[12px] leading-relaxed text-fg-subtle">{hint}</p>
      {href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-fg-muted transition-colors group-hover:text-fg">
          {cta}
          <ArrowRightIcon size={13} className="nudge-icon" />
        </span>
      ) : null}
    </>
  );

  const shell =
    "block rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }
  return (
    <Link href={href} className={cx(shell, "group hover:border-border-strong")}>
      {body}
    </Link>
  );
}

/**
 * A row of filter pills, driven by a button and the value it sets.
 *
 * Laid out with wrapping rather than sideways scrolling, and arrow keys move
 * between the pills, so nothing here needs a trackpad or a pointer.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  function step(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const at = options.findIndex((o) => o.value === value);
    const next = options[(at + delta + options.length) % options.length];
    if (next) onChange(next.value);
  }

  return (
    <div role="tablist" aria-label={label} className={cx("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const current = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={current}
            tabIndex={current ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={step}
            className={cx(
              "press inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              current
                ? "border-fg font-medium text-fg"
                : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {option.label}
            {option.count === undefined ? null : (
              <span className="font-mono text-[11px] tabular-nums text-fg-subtle">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The keycaps for the review desk's shortcuts, so they can be learned on sight. */
export function ShortcutLegend({
  items,
  className,
}: {
  items: { keys: string[]; label: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cx(
        "grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:gap-x-7",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-wrap items-center gap-1.5">
          <dt className="sr-only">{item.label}</dt>
          <dd className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-muted">
            {item.keys.map((key) => (
              <kbd key={key} className="kbd">
                {key}
              </kbd>
            ))}
            <span className="ml-1">{item.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Where the review desk opens on one submission, from anywhere in the console. */
export function reviewHref(id?: string): string {
  return id ? `/admin/queue?item=${encodeURIComponent(id)}` : "/admin/queue";
}

/** A creator's standing, keyed by creator id so a row can show it without a lookup. */
export function memberIndex(members: AdminMember[]): Map<string, AdminMember> {
  return new Map(members.map((m) => [m.id, m]));
}

/** Decisions recorded in the last thirty days, from the activity series. */
export function decisionTotals(activity: { approved: number; rejected: number }[]): {
  approved: number;
  rejected: number;
  decisions: number;
} {
  const approved = activity.reduce((n, day) => n + day.approved, 0);
  const rejected = activity.reduce((n, day) => n + day.rejected, 0);
  return { approved, rejected, decisions: approved + rejected };
}
