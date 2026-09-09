import Link from "next/link";
import { cx } from "@/lib/format";
import { SpinnerIcon } from "./icons";

/**
 * The primitives. Everything visual in the product is assembled from these, so
 * a change to a radius or a focus ring happens once.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-control)] " +
  "transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none " +
  "whitespace-nowrap select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary:
    "bg-surface text-fg border border-border hover:border-border-strong hover:bg-surface-raised",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-raised",
  danger: "bg-danger-soft text-danger border border-transparent hover:border-danger",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], extra);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      // Announces the pending state to assistive technology, not just visually.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <SpinnerIcon size={16} /> : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cx(
        "bg-surface border border-border rounded-[var(--radius-card)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full h-10 px-3 bg-surface border border-border rounded-[var(--radius-control)]",
        "text-sm text-fg placeholder:text-fg-subtle",
        "transition-colors hover:border-border-strong focus:border-accent",
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full px-3 py-2.5 bg-surface border border-border rounded-[var(--radius-control)]",
        "text-sm leading-relaxed text-fg placeholder:text-fg-subtle resize-y min-h-24",
        "transition-colors hover:border-border-strong focus:border-accent",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * A labelled form field.
 *
 * The label is always a real `<label>` bound by id, the hint is referenced by
 * `aria-describedby`, and an error is announced. Forms are where accessibility
 * lapses cost people the most, so this component makes the correct wiring the
 * path of least effort.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-[13px] text-fg-subtle">
          {hint}
        </p>
      ) : null}
      <div aria-describedby={cx(hintId, errorId) || undefined}>{children}</div>
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "outline" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-raised text-fg-muted border-border",
    accent: "bg-accent-soft text-accent border-transparent",
    outline: "bg-transparent text-fg-muted border-border",
    danger: "bg-danger-soft text-danger border-transparent",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center h-6 px-2 rounded-full border text-[12px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * An avatar. When there is no image the initials stand in, which keeps the
 * layout identical whether or not someone has uploaded a picture.
 */
export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-surface-raised border border-border text-fg-muted font-medium",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}

/** A labelled figure, used in profile and dashboard summaries. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[22px] font-semibold tabular-nums leading-tight">{value}</div>
      <div className="mt-0.5 text-[13px] text-fg-muted">{label}</div>
      {hint ? <div className="text-[12px] text-fg-subtle">{hint}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-5">
      <div>
        <h2 className="text-[19px] font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shown wherever a list can legitimately be empty. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon ? <div className="mb-4 text-fg-subtle">{icon}</div> : null}
      <h3 className="text-[15px] font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** The page shell: one max width, one gutter, used by every route. */
export function Container({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
}) {
  const widths = {
    narrow: "max-w-2xl",
    default: "max-w-5xl",
    wide: "max-w-6xl",
  } as const;
  return (
    <div className={cx("mx-auto w-full px-5 sm:px-6", widths[width], className)}>{children}</div>
  );
}

/** A centred pending state, used while a page is resolving something. */
export function SpinnerCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-fg-muted">
      <SpinnerIcon size={22} />
      <p className="text-sm">{label}…</p>
    </div>
  );
}
