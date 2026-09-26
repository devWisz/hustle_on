import Link from "next/link";
import { getViewer } from "@/lib/data";
import { enterDemo, exitDemo } from "@/lib/demo/actions";
import { cx } from "@/lib/format";
import { buttonClass } from "../ui/button";
import { ArrowRightIcon } from "../ui/icons";

export async function DemoBanner() {
  const viewer = await getViewer();
  if (!viewer.demo) return null;
  return (
    <div className="border-b border-border bg-inverse text-inverse-fg">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-[12.5px] sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
          <span aria-hidden className="h-1.5 w-1.5 animate-blink rounded-full bg-current" />
          Demo mode
        </span>
        <span className="min-w-0 flex-1 opacity-75">
          {viewer.online
            ? "You are exploring with sample data. Nothing you do here is saved."
            : "The API is offline, so every page is running on sample data. Nothing is saved."}
        </span>
        {viewer.online ? (
          <form action={exitDemo}>
            <input type="hidden" name="next" value="/" />
            <button type="submit" className="link-underline font-medium">
              Exit demo
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function EnterDemoButton({
  next = "/",
  label = "Explore the demo",
  variant = "secondary",
  size = "lg",
  className,
}: {
  next?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "inverse";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <form action={enterDemo} className="contents">
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={buttonClass(variant, size, className)}>
        {label}
        <ArrowRightIcon size={16} className="nudge-icon" />
      </button>
    </form>
  );
}

export function DemoGate({
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
        "flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
        className,
      )}
    >
      <div className="max-w-xl">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</p>
      </div>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className={buttonClass("primary", "md", "w-full shrink-0 sm:w-auto")}
      >
        Get a sign-in link
      </Link>
    </div>
  );
}
