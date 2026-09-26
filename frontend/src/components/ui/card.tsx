import { cx } from "@/lib/format";

export function Card({
  className,
  children,
  as: Tag = "div",
  interactive = false,
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article" | "section" | "li";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cx(
        "rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]",
        interactive && "lift",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
