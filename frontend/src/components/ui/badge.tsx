import type { TimelapseStatus } from "@/lib/types";
import { cx } from "@/lib/format";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-raised text-fg-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const STATUS: Record<TimelapseStatus, { text: string; tone: Tone }> = {
  draft: { text: "Draft", tone: "neutral" },
  uploaded: { text: "Not submitted", tone: "neutral" },
  in_review: { text: "In review", tone: "warning" },
  published: { text: "Published", tone: "success" },
  rejected: { text: "Needs changes", tone: "danger" },
  removed: { text: "Removed", tone: "neutral" },
};

export function StatusBadge({ status }: { status: TimelapseStatus }) {
  const label = STATUS[status] ?? STATUS.draft;
  return (
    <Badge tone={label.tone} dot>
      {label.text}
    </Badge>
  );
}
