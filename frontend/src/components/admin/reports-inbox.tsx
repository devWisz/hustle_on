"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { fetchAdminReports } from "@/lib/pagination";
import { cx, timeAgo } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Badge, Button, EmptyState, PagedList, type Tone } from "../ui";
import { AlertIcon, ExternalIcon } from "../ui/icons";
import { FilterTabs, Panel, rowPad } from "./console";

const REASON_LABEL: Record<Report["reason"], string> = {
  spam: "Spam",
  not_their_work: "Not their work",
  misleading: "Misleading",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  other: "Other",
};

const STATUS_TONE: Record<Report["status"], Tone> = {
  open: "warning",
  resolved: "success",
  dismissed: "neutral",
};

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "Everything" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

export function ReportsInbox({
  initial,
  initialCursor,
}: {
  initial: Report[];
  initialCursor?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  /**
   * Resolving or dismissing moves a report to another status, and the inbox is
   * ordered open first, so this component cannot re-sort or drop the item: each
   * close records its new status here and the render applies it over whatever
   * the pager holds. That keeps the report visible with its new badge, and
   * leaves the accumulated pages and their cursor untouched.
   */
  const [edits, setEdits] = useState<Record<string, Partial<Report>>>({});

  async function close(report: Report, status: "resolved" | "dismissed", note = "") {
    await api(`/v1/admin/reports/${report.id}/resolve`, { method: "POST", body: { status, note } });
    setEdits((current) => ({
      ...current,
      [report.id]: { status, resolvedAt: new Date().toISOString() },
    }));
  }

  async function act(report: Report, kind: "resolve" | "dismiss" | "remove-note" | "take-down") {
    setBusy(`${report.id}:${kind}`);
    try {
      if (kind === "remove-note" && report.note) {
        await api(
          `/v1/timelapses/${encodeURIComponent(report.timelapse.slug)}/notes/${report.note.id}`,
          {
            method: "DELETE",
          },
        );
        await close(report, "resolved", "Note removed");
        toast.success("Note removed and the report resolved.");
      } else if (kind === "take-down") {
        await api(`/v1/admin/timelapses/${report.timelapse.id}`, { method: "DELETE" });
        await close(report, "resolved", "Session taken down");
        toast.success("Session taken down and the report resolved.");
      } else {
        await close(report, kind === "resolve" ? "resolved" : "dismissed");
        toast.success(kind === "resolve" ? "Report resolved." : "Report dismissed.");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <PagedList
      initial={initial}
      initialCursor={initialCursor}
      load={(cursor) => fetchAdminReports(cursor, filter === "all" ? "" : filter)}
      // Switching tab changes the question, so the list starts over from a
      // filtered first page rather than keeping the unfiltered one the server
      // rendered and appending filtered pages to it.
      resetKey={filter}
      label="Load more reports"
      errorText="More reports could not be loaded. Try again."
      className="mt-5 flex flex-col items-center gap-3"
      render={(all) => {
        const reports = all.map((r) => {
          const edit = edits[r.id];
          return edit ? { ...r, ...edit } : r;
        });
        const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

        return (
          <>
            <FilterTabs
              label="Filter reports"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f.value,
                label: f.label,
                count:
                  f.value === "all"
                    ? reports.length
                    : reports.filter((r) => r.status === f.value).length,
              }))}
            />

            {visible.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<AlertIcon size={18} />}
                title={filter === "open" ? "Nothing to look at" : "No reports here"}
                description="When someone reports a session or a note, it lands here with their reason."
              />
            ) : (
              <Panel as="ul" rows className="mt-5">
                {visible.map((r) => {
                  const isOpen = r.status === "open";
                  const pending = (kind: string) => busy === `${r.id}:${kind}`;
                  return (
                    <li key={r.id} className={cx(rowPad, "space-y-3")}>
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <Badge tone={STATUS_TONE[r.status]} dot>
                          {r.status === "open"
                            ? "Open"
                            : r.status === "resolved"
                              ? "Resolved"
                              : "Dismissed"}
                        </Badge>
                        <Badge tone="danger">{REASON_LABEL[r.reason]}</Badge>
                        <span className="text-fg-subtle">
                          {r.subjectType === "note" ? "Note" : "Session"} reported by{" "}
                          {r.reporter ? r.reporter.displayName : "a deleted account"} ·{" "}
                          {timeAgo(r.createdAt)}
                        </span>
                      </div>

                      <Link
                        href={`/watch/${r.timelapse.slug}`}
                        className="inline-flex items-center gap-1.5 text-[15px] font-semibold hover:text-accent"
                      >
                        {r.timelapse.title}
                        <ExternalIcon size={13} className="text-fg-subtle" />
                      </Link>
                      <p className="text-[12.5px] text-fg-subtle">
                        by {r.timelapse.creator.displayName}
                        {r.timelapse.status !== "published"
                          ? ` · currently ${r.timelapse.status.replace("_", " ")}`
                          : ""}
                      </p>

                      {r.note ? (
                        <div className="flex gap-3 rounded-[var(--radius-control)] bg-surface-raised p-3">
                          <Avatar name={r.note.author.displayName} size={24} />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium">{r.note.author.displayName}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-muted">
                              {r.note.body}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {r.details ? (
                        <p className="border-l-2 border-border-strong pl-3 text-[13.5px] leading-relaxed text-fg-muted">
                          &ldquo;{r.details}&rdquo;
                        </p>
                      ) : null}

                      {isOpen ? (
                        <div className="flex flex-wrap gap-2">
                          {confirming === r.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={pending(r.note ? "remove-note" : "take-down")}
                                onClick={() => void act(r, r.note ? "remove-note" : "take-down")}
                              >
                                {r.note ? "Yes, remove the note" : "Yes, take the session down"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              {r.note || r.timelapse.status === "published" ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => setConfirming(r.id)}
                                >
                                  {r.note ? "Remove note" : "Take down session"}
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={pending("resolve")}
                                onClick={() => void act(r, "resolve")}
                              >
                                Mark resolved
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={pending("dismiss")}
                                onClick={() => void act(r, "dismiss")}
                              >
                                Dismiss
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </Panel>
            )}
          </>
        );
      }}
    />
  );
}
