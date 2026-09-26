import { cx } from "@/lib/format";

export function DemoTag({
  className,
  children = "Demo",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-border-strong bg-surface px-2 py-0.5",
        "font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DemoNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3",
        "text-[13px] leading-relaxed text-fg-muted",
        className,
      )}
    >
      <DemoTag className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
