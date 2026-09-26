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
      <div>
        <h1 className="text-[clamp(1.6rem,1.3rem+1.2vw,2.25rem)] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}
