"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { cx, timeAgo } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Badge, Button, EmptyState, type Tone } from "../ui";
import { AlertIcon, ExternalIcon } from "../ui/icons";

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
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export function ReportsInbox({ initial }: { initial: Report[] }) {
  const router = useRouter();
  const toast = useToast();
  const [reports, setReports] = useState(initial);
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  async function close(report: Report, status: "resolved" | "dismissed", note = "") {
    await api(`/v1/admin/reports/${report.id}/resolve`, { method: "POST", body: { status, note } });
    setReports((list) =>
      list.map((r) => (r.id === report.id ? { ...r, status, resolvedAt: new Date().toISOString() } : r)),
    );
  }

  async function act(report: Report, kind: "resolve" | "dismiss" | "remove-note" | "take-down") {
    setBusy(`${report.id}:${kind}`);
    try {
      if (kind === "remove-note" && report.note) {
        await api(`/v1/timelapses/${encodeURIComponent(report.timelapse.slug)}/notes/${report.note.id}`, {
          method: "DELETE",
        });
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
    <div>
      <div role="tablist" aria-label="Filter reports" className="scroll-x -mx-4 flex gap-1 px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? reports.length : reports.filter((r) => r.status === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                "press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                filter === f.id ? "bg-inverse text-inverse-fg" : "text-fg-muted hover:bg-surface-raised hover:text-fg",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[11px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<AlertIcon size={18} />}
          title={filter === "open" ? "Nothing to look at" : "No reports here"}
          description="When someone reports a session or a note, it lands here with their reason."
        />
      ) : (
        <ul className="mt-5 space-y-3">
          {visible.map((r) => {
            const isOpen = r.status === "open";
            const pending = (kind: string) => busy === `${r.id}:${kind}`;
            return (
              <li key={r.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <Badge tone={STATUS_TONE[r.status]} dot>
                    {r.status === "open" ? "Open" : r.status === "resolved" ? "Resolved" : "Dismissed"}
                  </Badge>
                  <Badge tone="danger">{REASON_LABEL[r.reason]}</Badge>
                  <span className="text-fg-subtle">
                    {r.subjectType === "note" ? "Note" : "Session"} reported by{" "}
                    {r.reporter ? r.reporter.displayName : "a deleted account"} · {timeAgo(r.createdAt)}
                  </span>
                </div>

                <Link
                  href={`/watch/${r.timelapse.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold hover:text-accent"
                >
                  {r.timelapse.title}
                  <ExternalIcon size={13} className="text-fg-subtle" />
                </Link>
                <p className="mt-0.5 text-[12.5px] text-fg-subtle">
                  by {r.timelapse.creator.displayName}
                  {r.timelapse.status !== "published" ? ` · currently ${r.timelapse.status.replace("_", " ")}` : ""}
                </p>

                {r.note ? (
                  <div className="mt-3 flex gap-3 rounded-[var(--radius-control)] bg-surface-raised p-3">
                    <Avatar name={r.note.author.displayName} size={24} />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium">{r.note.author.displayName}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-muted">{r.note.body}</p>
                    </div>
                  </div>
                ) : null}

                {r.details ? (
                  <p className="mt-3 border-l-2 border-border-strong pl-3 text-[13.5px] leading-relaxed text-fg-muted">
                    &ldquo;{r.details}&rdquo;
                  </p>
                ) : null}

                {isOpen ? (
                  <div className="mt-4 flex flex-wrap gap-2">
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
                        {(r.note || r.timelapse.status === "published") ? (
                          <Button size="sm" variant="danger" onClick={() => setConfirming(r.id)}>
                            {r.note ? "Remove note" : "Take down session"}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="secondary" loading={pending("resolve")} onClick={() => void act(r, "resolve")}>
                          Mark resolved
                        </Button>
                        <Button size="sm" variant="ghost" loading={pending("dismiss")} onClick={() => void act(r, "dismiss")}>
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
