import type { AuditEntry } from "@/lib/types";
import { Avatar, Card } from "../ui";
import { timeAgo } from "@/lib/format";
import { CheckIcon, CloseIcon, ShieldIcon, TrashIcon } from "../ui/icons";

const ACTIONS: Record<string, { label: string; tone: "accent" | "danger" | "neutral" }> = {
  "timelapse.approve": { label: "Published", tone: "accent" },
  "timelapse.reject": { label: "Sent back", tone: "danger" },
  "timelapse.takedown": { label: "Taken down", tone: "danger" },
  "note.delete": { label: "Note removed", tone: "neutral" },
};

const TONES = {
  accent: "border-accent/30 bg-accent-soft text-accent",
  danger: "border-danger/30 bg-danger-soft text-danger",
  neutral: "border-border bg-surface-raised text-fg-muted",
} as const;

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-fg-muted">
          No decisions recorded yet. Every approval, rejection and takedown appears here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="px-5">
      <ul className="divide-y divide-border">
        {entries.map((entry) => {
          const meta = ACTIONS[entry.action] ?? { label: entry.action, tone: "neutral" as const };
          const note = typeof entry.metadata?.note === "string" ? entry.metadata.note : null;

          return (
            <li key={entry.id} className="flex flex-wrap items-start gap-3 py-3.5">
              {entry.actor ? (
                <Avatar
                  name={entry.actor.displayName}
                  src={entry.actor.avatarUrl}
                  size={26}
                  className="mt-0.5"
                />
              ) : (

                <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-fg-subtle">
                  <ShieldIcon size={13} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-medium">
                    {entry.actor ? entry.actor.displayName : "Deleted account"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[meta.tone]}`}
                  >
                    {meta.tone === "accent" ? (
                      <CheckIcon size={11} />
                    ) : meta.tone === "danger" ? (
                      <CloseIcon size={11} />
                    ) : (
                      <TrashIcon size={11} />
                    )}
                    {meta.label}
                  </span>
                  <span className="text-[12px] text-fg-subtle">
                    {entry.subjectType}
                    {entry.subjectId ? ` · ${entry.subjectId.slice(0, 8)}` : ""}
                  </span>
                </div>

                {note ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">
                    “{note}”
                  </p>
                ) : null}
              </div>

              <time
                dateTime={entry.createdAt}
                className="shrink-0 text-[12px] text-fg-subtle"
                title={new Date(entry.createdAt).toLocaleString()}
              >
                {timeAgo(entry.createdAt)}
              </time>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
