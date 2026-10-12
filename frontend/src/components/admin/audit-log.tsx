"use client";

import { useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { downloadCsv } from "@/lib/csv";
import { cx, formatStamp, timeAgo } from "@/lib/format";
import { Avatar, Badge, Button, EmptyState, SearchField, type Tone } from "../ui";
import { DownloadIcon, ListIcon, ShieldIcon } from "../ui/icons";
import { FilterTabs, Panel, rowPad } from "./console";

const ACTIONS: Record<string, { label: string; tone: Tone }> = {
  "timelapse.approve": { label: "Published", tone: "success" },
  "timelapse.reject": { label: "Sent back", tone: "warning" },
  "timelapse.takedown": { label: "Taken down", tone: "danger" },
  "note.delete": { label: "Note removed", tone: "neutral" },
  "member.suspend": { label: "Suspended", tone: "danger" },
  "member.reinstate": { label: "Reinstated", tone: "success" },
  "report.resolve": { label: "Report resolved", tone: "success" },
  "report.dismiss": { label: "Report dismissed", tone: "neutral" },
  "timelapse.feature": { label: "Featured", tone: "accent" },
  "timelapse.unfeature": { label: "Unfeatured", tone: "neutral" },
  // Editing something already published moves no status, so the trail is the
  // only place it shows up at all.
  "timelapse.edit": { label: "Edited", tone: "accent" },
  "timelapse.thumbnail": { label: "Poster changed", tone: "neutral" },
  "timelapse.thumbnail.clear": { label: "Poster removed", tone: "neutral" },
  "featured.reorder": { label: "Front page rearranged", tone: "accent" },
};

/** The decisions on a submission, in the order the overview counts them. */
function meta(action: string) {
  return ACTIONS[action] ?? { label: action, tone: "neutral" as Tone };
}

function text(entry: AuditEntry, key: string): string | null {
  const value = entry.metadata?.[key];
  return typeof value === "string" ? value : null;
}

/** A list-valued metadata field, such as the front page's new order. */
function list(entry: AuditEntry, key: string): string[] {
  const value = entry.metadata?.[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function AuditRow({ entry, compact = false }: { entry: AuditEntry; compact?: boolean }) {
  const m = meta(entry.action);
  const title = text(entry, "title");
  const note = text(entry, "note");
  // A shelf-wide action has no single subject to name, so it reports the order it
  // set instead — the thing the operator actually changed.
  const order = list(entry, "order");
  const summary = title ?? (order.length ? order.join(" › ") : null);
  return (
    <li className={cx("flex items-start gap-3", compact ? "py-3" : rowPad)}>
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
          {summary && !compact ? (
            <span className="min-w-0 truncate text-fg-muted">{summary}</span>
          ) : null}
        </p>
        {compact && summary ? (
          <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">{summary}</p>
        ) : null}
        {note ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fg-muted">
            &ldquo;{note}&rdquo;
          </p>
        ) : null}
        {!compact ? (
          <p className="mt-1 font-mono text-[11px] text-fg-subtle">
            {entry.subjectType.replace(/_/g, " ")}
            {entry.subjectId ? ` · ${entry.subjectId.slice(0, 10)}` : ""}
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
  const options = useMemo(
    () => [
      { value: "all", label: "Everything" },
      ...actions.map((a) => ({ value: a, label: meta(a).label })),
    ],
    [actions],
  );
  const visible = entries.filter((e) => {
    if (action !== "all" && e.action !== action) return false;
    if (!query.trim()) return true;
    const hay = [
      e.actor?.displayName,
      text(e, "title"),
      text(e, "note"),
      list(e, "order").join(" "),
      e.subjectId,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  function exportCsv() {
    downloadCsv("hustleon-audit.csv", [
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          placeholder="Search by person, title or note"
          aria-label="Search the audit trail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="lg:max-w-xs lg:flex-1"
        />
        <FilterTabs
          label="Filter by action"
          options={options}
          value={action}
          onChange={setAction}
        />
        <Button variant="secondary" size="sm" onClick={exportCsv} className="lg:ml-auto">
          <DownloadIcon size={14} />
          CSV
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<ListIcon size={18} />}
          title={entries.length === 0 ? "No decisions recorded yet" : "No entries match"}
          description={
            entries.length === 0
              ? "Every approval, rejection and takedown is written here, newest first."
              : "Try another action filter, or clear it to see everything."
          }
        />
      ) : (
        <Panel as="ul" rows className="mt-5">
          {visible.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </Panel>
      )}
    </div>
  );
}
