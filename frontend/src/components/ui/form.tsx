import { cx } from "@/lib/format";
import { ChevronDownIcon, SearchIcon } from "./icons";

const control =
  "w-full rounded-[var(--radius-control)] border border-border bg-surface text-base text-fg sm:text-sm " +
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-200 hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-fg-subtle disabled:opacity-60";

export function Input({ className, ...rest }: React.ComponentProps<"input">) {
  return <input className={cx(control, "h-11 px-3.5", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(control, "min-h-24 resize-y px-3.5 py-3 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: React.ComponentProps<"select">) {
  return (
    <span className={cx("relative inline-block", className)}>
      <select className={cx(control, "h-10 appearance-none pl-3.5 pr-9")} {...rest}>
        {children}
      </select>
      <ChevronDownIcon
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
    </span>
  );
}

export function SearchField({ className, ...rest }: React.ComponentProps<"input">) {
  return (
    <label className={cx("relative block", className)}>
      <span className="sr-only">{rest["aria-label"] ?? "Search"}</span>
      <SearchIcon
        size={15}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input type="search" className={cx(control, "h-10 pl-10 pr-3.5")} {...rest} />
    </label>
  );
}

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
    <div className={cx("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-[13px] leading-relaxed text-fg-subtle">
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
