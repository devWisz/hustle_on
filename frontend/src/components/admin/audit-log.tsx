"use client";

import { useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { downloadCsv } from "@/lib/csv";
import { cx, formatStamp, timeAgo } from "@/lib/format";
import { Avatar, Badge, Button, EmptyState, SearchField, type Tone } from "../ui";
import { DownloadIcon, ListIcon, ShieldIcon } from "../ui/icons";

const ACTIONS: Record<string, { label: string; tone: Tone }> = {
  "timelapse.approve": { label: "Published", tone: "success" },
  "timelapse.reject": { label: "Sent back", tone: "warning" },
  "timelapse.takedown": { label: "Taken down", tone: "danger" },
  "note.delete": { label: "Note removed", tone: "neutral" },
  "member.suspend": { label: "Suspended", tone: "danger" },
  "member.reinstate": { label: "Reinstated", tone: "success" },
};

function meta(action: string) {
  return ACTIONS[action] ?? { label: action, tone: "neutral" as Tone };
}

function text(entry: AuditEntry, key: string): string | null {
  const value = entry.metadata?.[key];
  return typeof value === "string" ? value : null;
}

export function AuditRow({ entry, compact = false }: { entry: AuditEntry; compact?: boolean }) {
  const m = meta(entry.action);
  const title = text(entry, "title");
  const note = text(entry, "note");
  return (
    <li className={cx("flex items-start gap-3", compact ? "py-3" : "px-4 py-4 sm:px-5")}>
      {entry.actor ? (
        <Avatar name={entry.actor.displayName} src={entry.actor.avatarUrl} size={28} />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-fg-subtle">
          <ShieldIcon size={13} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
          <span className="font-medium">{entry.actor?.displayName ?? "Deleted account"}</span>
          <Badge tone={m.tone} className="h-5 px-2 text-[11px]">
            {m.label}
          </Badge>
          {title && !compact ? (
            <span className="min-w-0 truncate text-fg-muted">{title}</span>
          ) : null}
        </p>
        {compact && title ? (
          <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">{title}</p>
        ) : null}
        {note ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fg-muted">
            &ldquo;{note}&rdquo;
          </p>
        ) : null}
        {!compact ? (
          <p className="mt-1 font-mono text-[11px] text-fg-subtle">
            {entry.subjectType} · {entry.subjectId?.slice(0, 10) ?? "none"}
          </p>
        ) : null}
      </div>
      <time
        dateTime={entry.createdAt}
        title={formatStamp(entry.createdAt)}
        className="shrink-0 text-[12px] text-fg-subtle"
      >
        {timeAgo(entry.createdAt)}
      </time>
    </li>
  );
}

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");

  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))), [entries]);
  const visible = entries.filter((e) => {
    if (action !== "all" && e.action !== action) return false;
    if (!query.trim()) return true;
    const hay = [e.actor?.displayName, text(e, "title"), text(e, "note"), e.subjectId]
      .join(" ")
      .toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  function exportCsv() {
    downloadCsv("sardhana-audit.csv", [
      ["time", "actor", "action", "subject", "title", "note"],
      ...visible.map((e) => [
        e.createdAt,
        e.actor?.displayName,
        e.action,
        `${e.subjectType}:${e.subjectId ?? ""}`,
        text(e, "title") ?? "",
        text(e, "note") ?? "",
      ]),
    ]);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          placeholder="Search by person, title or note"
          aria-label="Search the audit trail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs sm:flex-1"
        />
        <div className="scroll-x -mx-4 flex gap-1 px-4 sm:mx-0 sm:px-0">
          {["all", ...actions].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              aria-pressed={action === a}
              className={cx(
                "press shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                action === a
                  ? "border-fg text-fg"
                  : "border-border text-fg-muted hover:border-border-strong",
              )}
            >
              {a === "all" ? "Everything" : meta(a).label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} className="sm:ml-auto">
          <DownloadIcon size={14} />
          CSV
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<ListIcon size={18} />}
          title="No matching entries"
          description="Every approval, rejection and takedown is recorded here."
        />
      ) : (
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {visible.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
