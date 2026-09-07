"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { MODERATION_ACTIONS, type Report } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

/**
 * The moderation queue.
 *
 * Resolving a report is one call: the API applies the decision, hides or
 * removes the content, revokes sessions when an account is suspended, and
 * writes the audit entry — all inside one transaction, so a recorded decision
 * always matches what actually happened.
 */
export function ReportQueue({ reports, isAdmin }: { reports: Report[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const actions = MODERATION_ACTIONS.filter((action) => isAdmin || !action.adminOnly);

  async function resolve(report: Report, action: string) {
    setBusyId(report.id);
    setError(null);
    try {
      await api(`/v1/admin/reports/${report.id}/resolve`, {
        body: { action, note: notes[report.id] ?? "" },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That decision could not be applied.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {reports.map((report) => (
        <Card key={report.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={report.reportCount > 2 ? "danger" : "neutral"}>
                  {report.reason.replace(/_/g, " ")}
                </Badge>
                <span className="text-[12px] text-fg-subtle">
                  {report.subjectType} · {report.reportCount} report
                  {report.reportCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 font-mono text-[12px] text-fg-muted">{report.subjectId}</p>
            </div>
            <span className="text-[12px] text-fg-subtle">
              {new Date(report.createdAt).toLocaleString()}
            </span>
          </div>

          {report.detail ? (
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">
              {report.detail}
            </p>
          ) : null}

          <p className="mt-2 text-[12px] text-fg-subtle">
            Reported by {report.reporter ? `@${report.reporter.handle}` : "a removed account"}
          </p>

          <label className="mt-4 block">
            <span className="sr-only">Resolution note for report {report.id}</span>
            <input
              type="text"
              placeholder="Note for the audit log (optional)"
              value={notes[report.id] ?? ""}
              onChange={(event) => setNotes({ ...notes, [report.id]: event.target.value })}
              className="h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-[13px]"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.value}
                variant={action.value.startsWith("user_") ? "danger" : "secondary"}
                disabled={busyId === report.id}
                onClick={() => resolve(report, action.value)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
