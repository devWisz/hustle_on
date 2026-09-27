"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { useToast } from "../layout/toast";
import type { Timelapse, TimelapseStatus } from "@/lib/types";
import { cx, formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";
import { Button, EmptyState, Field, Input, StatusBadge, Textarea } from "../ui";
import { FilmIcon } from "../ui/icons";

const FILTERS: { id: "all" | TimelapseStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "in_review", label: "In review" },
  { id: "rejected", label: "Needs changes" },
];

export function Submissions({ items: initial, demo }: { items: Timelapse[]; demo: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const visible = filter === "all" ? items : items.filter((t) => t.status === filter);
  const linkable = !demo;

  async function withdraw(t: Timelapse) {
    setBusy(t.id);
    try {
      if (!demo) await api(`/v1/timelapses/${t.id}`, { method: "DELETE" });
      setItems((list) => list.map((x) => (x.id === t.id ? { ...x, status: "removed" } : x)));
      toast.success(
        demo ? "Demo: withdrawn in this view only." : "Withdrawn. It is no longer public.",
      );
      if (!demo) router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That could not be withdrawn.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  function resubmitted(updated: Timelapse) {
    setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    setEditing(null);
    if (!demo) router.refresh();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter submissions"
        className="scroll-x -mx-4 flex gap-1 px-4 sm:mx-0 sm:px-0"
      >
        {FILTERS.map((f) => {
          const count =
            f.id === "all" ? items.length : items.filter((t) => t.status === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                "press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                filter === f.id
                  ? "bg-inverse text-inverse-fg"
                  : "text-fg-muted hover:bg-surface-raised hover:text-fg",
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
          icon={<FilmIcon size={18} />}
          title="Nothing here"
          description="No submissions match this filter."
        />
      ) : (
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {visible.map((t) => {
            const href = linkable && t.status === "published" ? `/watch/${t.slug}` : null;
            return (
              <li key={t.id} className="p-4 sm:p-5">
                <div className="flex gap-4">
                  <span className="relative aspect-video w-24 shrink-0 self-start overflow-hidden rounded-lg border border-border bg-surface-raised sm:w-36">
                    {t.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {href ? (
                          <Link href={href} className="transition-colors hover:text-accent">
                            {t.title}
                          </Link>
                        ) : (
                          t.title
                        )}
                      </h3>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1.5 text-[13px] text-fg-muted">
                      {[
                        t.sessionMinutes > 0 ? formatSession(t.sessionMinutes) : null,
                        `submitted ${timeAgo(t.submittedAt ?? t.createdAt)}`,
                        t.status === "published" ? `${formatCount(t.viewCount)} views` : null,
                        t.donationTotalLamports > 0
                          ? `${formatSol(t.donationTotalLamports)} raised`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {t.status === "rejected" && t.reviewNote ? (
                      <div className="mt-3 rounded-[var(--radius-control)] border border-danger/20 bg-danger-soft px-3.5 py-3">
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-danger">
                          Reviewer note
                        </p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-fg">{t.reviewNote}</p>
                      </div>
                    ) : null}
                    {editing === t.id ? (
                      <ResubmitForm
                        timelapse={t}
                        demo={demo}
                        onDone={resubmitted}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t.status === "rejected" ? (
                          <Button size="sm" onClick={() => setEditing(t.id)}>
                            Edit and resubmit
                          </Button>
                        ) : null}
                        {t.status === "in_review" || t.status === "published" ? (
                          confirming === t.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={busy === t.id}
                                onClick={() => void withdraw(t)}
                              >
                                Confirm withdraw
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                                Keep it
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => setConfirming(t.id)}>
                              Withdraw
                            </Button>
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResubmitForm({
  timelapse,
  demo,
  onDone,
  onCancel,
}: {
  timelapse: Timelapse;
  demo: boolean;
  onDone: (t: Timelapse) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(timelapse.title);
  const [summary, setSummary] = useState(timelapse.summary);
  const [minutes, setMinutes] = useState(String(timelapse.sessionMinutes || ""));
  const [githubUrl, setGithubUrl] = useState(timelapse.githubUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFields({});
    try {
      if (!demo) {
        await api<Timelapse>(`/v1/timelapses/${timelapse.id}`, {
          method: "PATCH",
          body: {
            title: title.trim(),
            summary: summary.trim(),
            ...(Number(minutes) > 0 ? { sessionMinutes: Number(minutes) } : {}),
            ...(githubUrl.trim() ? { githubUrl: githubUrl.trim() } : {}),
          },
        });
        await api(`/v1/timelapses/${timelapse.id}/submit`, { method: "POST" });
      }
      onDone({ ...timelapse, title, summary, status: "in_review", reviewNote: undefined });
      toast.success(demo ? "Demo: resubmitted in this view only." : "Sent back to review.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (!Object.keys(err.fields).length) toast.error(err.message);
      } else {
        toast.error("That could not be resubmitted.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="mt-4 space-y-4 rounded-[var(--radius-control)] border border-border p-4"
      noValidate
    >
      <Field label="Title" htmlFor={`t-${timelapse.id}`} error={fields.title}>
        <Input
          id={`t-${timelapse.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </Field>
      <Field
        label="What you did"
        htmlFor={`s-${timelapse.id}`}
        hint="Answer the reviewer's note."
        error={fields.summary}
      >
        <Textarea
          id={`s-${timelapse.id}`}
          rows={6}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={4000}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Session length in minutes"
          htmlFor={`m-${timelapse.id}`}
          error={fields.sessionMinutes}
        >
          <Input
            id={`m-${timelapse.id}`}
            type="number"
            min="1"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
        <Field label="GitHub URL" htmlFor={`g-${timelapse.id}`} error={fields.githubUrl}>
          <Input
            id={`g-${timelapse.id}`}
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/you/project"
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={summary.trim().length < 40}>
          Resubmit for review
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
