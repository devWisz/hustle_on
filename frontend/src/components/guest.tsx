import Link from "next/link";
import { isGuestPreview } from "@/lib/guest-server";
import { enterGuestPreview, exitGuestPreview } from "@/lib/guest-actions";
import { buttonClass } from "./ui";
import { cx } from "@/lib/format";
import { ArrowRightIcon, EyeIcon } from "./icons";

/**
 * The guest-preview surfaces.
 *
 * Everything a guest sees that a signed-in visitor does not lives here, so the
 * wording of the promise — look at anything, change nothing — is written once.
 */

/**
 * The bar under the header while a preview is running.
 *
 * It is not sticky. A persistent band eating the top of every screen is the
 * thing that makes a preview feel like a trial rather than a product, and the
 * state is restated on each page that needs it anyway.
 */
export async function GuestBanner() {
  if (!(await isGuestPreview())) return null;

  return (
    <div className="border-b border-border bg-surface-raised">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-fg-muted">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-fg">
            <EyeIcon size={11} />
            Guest
          </span>
          <span className="min-w-0">
            You are looking around without an account. Nothing here can be saved.
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <Link href="/login" className={buttonClass("primary", "sm")}>
            Create an account
          </Link>
          <ExitGuestButton />
        </div>
      </div>
    </div>
  );
}

/** Leaves preview mode and returns to the feed. */
export function ExitGuestButton({ className }: { className?: string }) {
  return (
    <form action={exitGuestPreview}>
      <input type="hidden" name="next" value="/" />
      <button type="submit" className={buttonClass("ghost", "sm", className)}>
        Exit preview
      </button>
    </form>
  );
}

/**
 * The button that starts a preview.
 *
 * `next` is where the visitor lands afterwards, so the button can drop them
 * straight into the screen they were curious about.
 */
export function EnterGuestButton({
  next = "/",
  label = "Look around first",
  variant = "secondary",
  size = "lg",
  className,
  withIcon = false,
}: {
  next?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  withIcon?: boolean;
}) {
  return (
    // `contents` keeps the wrapper out of the layout, so the button sits in the
    // parent's flex or grid row exactly as a plain button would.
    <form action={enterGuestPreview} className="contents">
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={buttonClass(variant, size, cx("group", className))}>
        {label}
        {withIcon ? <ArrowRightIcon size={16} className="nudge-icon" /> : null}
      </button>
    </form>
  );
}

/**
 * The note that stands in for an action a guest cannot take.
 *
 * It says what is missing and offers the two ways out, rather than disabling a
 * control and leaving somebody to work out why it does nothing.
 */
export function GuestGate({
  title,
  body,
  next,
  className,
}: {
  title: string;
  body: string;
  next: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface p-5",
        className,
      )}
    >
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-fg-muted">{body}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className={buttonClass("primary", "md", "w-full sm:w-auto")}
        >
          Get a sign-in link
        </Link>
        <ExitGuestButton className="w-full sm:w-auto" />
      </div>
    </div>
  );
}

/**
 * The label on anything invented.
 *
 * Sample content is only ever useful if it is unmistakable, so this sits on
 * every card, panel and figure that is not a real record.
 */
export function SampleTag({ className, children = "Sample" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-border-strong bg-surface px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A one-line explanation above a screen built entirely from sample records. */
export function SampleNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cx(
        "flex items-start gap-2 rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 py-2",
        "text-[13px] leading-relaxed text-fg-muted",
        className,
      )}
    >
      <SampleTag className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
