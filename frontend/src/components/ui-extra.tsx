import { SpinnerIcon } from "./icons";

export { ButtonLink } from "./ui";

/** A centred pending state for full-page waits. */
export function SpinnerCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-fg-muted" role="status">
      <SpinnerIcon size={22} />
      <p className="mt-4 text-sm">{label}</p>
    </div>
  );
}
