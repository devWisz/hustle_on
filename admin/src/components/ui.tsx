export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-[var(--radius-card)] ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[22px] font-semibold tabular-nums leading-tight">{value}</div>
      <div className="mt-0.5 text-[13px] text-fg-muted">{label}</div>
    </div>
  );
}

export function Button({
  variant = "secondary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variants = {
    primary: "bg-accent text-accent-fg hover:bg-accent-hover border-transparent",
    secondary: "bg-surface text-fg border-border hover:border-border-strong",
    danger: "bg-danger-soft text-danger border-transparent hover:border-danger",
  } as const;
  return (
    <button
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-control)]
                  border px-3 text-[13px] font-medium transition-colors
                  disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" }) {
  const tones = {
    neutral: "bg-surface-raised text-fg-muted border-border",
    danger: "bg-danger-soft text-danger border-transparent",
  } as const;
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[12px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Shown when the API refuses a request for lack of a role. */
export function AccessDenied({ status }: { status: number }) {
  const signedOut = status === 401;
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-[20px] font-semibold">
        {signedOut ? "Sign in required" : "You do not have access"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {signedOut
          ? "Sign in on the main site first; this console uses the same session."
          : "This console is limited to moderators and admins. If you should have access, ask an admin to grant your account the role."}
      </p>
      {signedOut ? (
        <a
          href={`${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/login`}
          className="mt-6 inline-flex h-9 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          Go to sign in
        </a>
      ) : null}
    </div>
  );
}
