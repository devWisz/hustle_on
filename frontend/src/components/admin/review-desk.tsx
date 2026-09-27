"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { cx, formatSession } from "@/lib/format";
import { formatWait, reviewFlags, waitingMinutes } from "@/lib/review";
import type { Timelapse } from "@/lib/types";
import { useToast } from "../layout/toast";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { Avatar, Badge, Button, EmptyState, SearchField, Select, Textarea } from "../ui";
import { ArrowLeftIcon, CheckIcon, ExternalIcon, GitHubIcon, InboxIcon, XIcon } from "../ui/icons";

const TEMPLATES = [
  "The write-up does not say what changed or why. Describe what you set out to do and what you ended up with.",
  "There is no link to the result. Add the repository, commit or post so a reviewer can check the work.",
  "The recording does not appear to match the write-up. Make sure the clip shows the session described.",
  "The session length looks off compared to the recording. Give the real time spent on the work.",
];

const CHECKS = [
  "The write-up describes the work in the recording",
  "Links point at the result, or the work stands on its own",
  "Nothing in it is someone else's work",
];

type Sort = "oldest" | "newest" | "longest";

export function ReviewDesk({ initial, initialId }: { initial: Timelapse[]; initialId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [queue, setQueue] = useState(initial);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("oldest");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId ?? undefined);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialId));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState({ approved: 0, rejected: 0 });
  const detail = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? queue.filter((t) =>
          `${t.title} ${t.creator.displayName} ${t.summary}`.toLowerCase().includes(q),
        )
      : queue;
    return [...filtered].sort((a, b) =>
      sort === "longest"
        ? b.sessionMinutes - a.sessionMinutes
        : sort === "newest"
          ? waitingMinutes(a) - waitingMinutes(b)
          : waitingMinutes(b) - waitingMinutes(a),
    );
  }, [queue, query, sort]);

  const current = visible.find((t) => t.id === selectedId) ?? visible[0];
  const index = current ? visible.indexOf(current) : -1;

  useEffect(() => {
    setRejecting(false);
    setNote("");
    setChecks(CHECKS.map(() => false));
  }, [current?.id]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from("[data-detail]", { y: 14, autoAlpha: 0, stagger: 0.05, duration: 0.5 });
      });
    },
    { scope: detail, dependencies: [current?.id] },
  );

  const select = useCallback((id: string | undefined) => {
    setSelectedId(id);
    setMobileDetail(Boolean(id));
  }, []);

  const move = useCallback(
    (delta: number) => {
      const next = visible[Math.min(visible.length - 1, Math.max(0, index + delta))];
      if (next) setSelectedId(next.id);
    },
    [visible, index],
  );

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      if (!current || busy) return;
      if (action === "reject" && note.trim().length < 10) return;
      setBusy(true);
      try {
        await api(`/v1/admin/timelapses/${current.id}/${action}`, {
          method: "POST",
          body: action === "reject" ? { note: note.trim() } : undefined,
        });
        const next = visible[index + 1] ?? visible[index - 1];
        setQueue((q) => q.filter((t) => t.id !== current.id));
        setSelectedId(next?.id);
        setDecided((d) => ({
          ...d,
          [action === "approve" ? "approved" : "rejected"]:
            d[action === "approve" ? "approved" : "rejected"] + 1,
        }));
        toast.success(
          action === "approve" ? "Published." : "Sent back to the creator with your note.",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "That decision did not go through.");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, note, visible, index, toast, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
        if (e.key === "Escape") {
          el.blur();
          setRejecting(false);
        }
        return;
      }
      if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "a") void decide("approve");
      else if (e.key === "r") {
        e.preventDefault();
        setRejecting(true);
        requestAnimationFrame(() => noteRef.current?.focus());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, decide]);

  const flags = current ? reviewFlags(current) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fg-muted">
        <span>
          <span className="font-mono text-fg">{queue.length}</span> waiting
        </span>
        <span>
          <span className="font-mono text-fg">{decided.approved}</span> approved and{" "}
          <span className="font-mono text-fg">{decided.rejected}</span> sent back this session
        </span>
        <span className="ml-auto hidden items-center gap-1.5 md:flex">
          <span className="kbd">J</span>
          <span className="kbd">K</span> move
          <span className="kbd ml-2">A</span> approve
          <span className="kbd ml-2">R</span> send back
        </span>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<InboxIcon size={18} />}
          title="The queue is clear"
          description="Every submission has a decision. New ones appear here as they arrive."
        />
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className={cx("space-y-3", mobileDetail && "hidden lg:block")}>
            <SearchField
              placeholder="Search the queue"
              aria-label="Search the queue"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort"
              className="w-full"
            >
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
              <option value="longest">Longest session</option>
            </Select>
            <ul className="space-y-1.5" aria-label="Submissions">
              {visible.map((t) => {
                const itemFlags = reviewFlags(t);
                const selected = t.id === current?.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => select(t.id)}
                      aria-current={selected ? "true" : undefined}
                      className={cx(
                        "w-full rounded-[var(--radius-card)] border p-3.5 text-left transition-colors",
                        selected
                          ? "border-fg bg-surface"
                          : "border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      <p className="line-clamp-2 text-[14px] font-medium leading-snug">{t.title}</p>
                      <p className="mt-1.5 flex items-center gap-2 text-[12px] text-fg-subtle">
                        <Avatar name={t.creator.displayName} size={18} />
                        <span className="truncate">{t.creator.displayName}</span>
                        <span className="ml-auto shrink-0 font-mono">
                          {formatWait(waitingMinutes(t))}
                        </span>
                      </p>
                      {itemFlags.length ? (
                        <p className="mt-2 flex flex-wrap gap-1">
                          {itemFlags.map((f) => (
                            <Badge key={f.label} tone={f.tone} className="h-5 px-2 text-[10.5px]">
                              {f.label}
                            </Badge>
                          ))}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 ? (
                <li className="p-3 text-[13px] text-fg-muted">Nothing matches that search.</li>
              ) : null}
            </ul>
          </div>

          {current ? (
            <div ref={detail} className={cx("min-w-0", !mobileDetail && "hidden lg:block")}>
              <button
                type="button"
                onClick={() => setMobileDetail(false)}
                className="mb-4 inline-flex items-center gap-2 text-[13px] text-fg-muted lg:hidden"
              >
                <ArrowLeftIcon size={15} />
                Back to the queue
              </button>

              <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
                <div data-detail className="bg-black">
                  {current.playbackUrl ? (
                    <video
                      key={current.id}
                      src={current.playbackUrl}
                      poster={current.thumbnailUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-[13px] text-white/60">
                      No video attached
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  <div
                    data-detail
                    className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-muted"
                  >
                    <Avatar name={current.creator.displayName} size={22} />
                    <span className="font-medium text-fg">{current.creator.displayName}</span>
                    <span>@{current.creator.handle}</span>
                    <span aria-hidden>·</span>
                    <span>waiting {formatWait(waitingMinutes(current))}</span>
                    {current.sessionMinutes ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formatSession(current.sessionMinutes)}</span>
                      </>
                    ) : null}
                  </div>
                  <h2
                    data-detail
                    className="mt-3 text-[clamp(1.25rem,1.1rem+0.6vw,1.6rem)] font-semibold leading-snug tracking-tight"
                  >
                    {current.title}
                  </h2>
                  {flags.length ? (
                    <p data-detail className="mt-3 flex flex-wrap gap-1.5">
                      {flags.map((f) => (
                        <Badge key={f.label} tone={f.tone} dot>
                          {f.label}
                        </Badge>
                      ))}
                    </p>
                  ) : null}
                  <div
                    data-detail
                    className="mt-5 max-h-72 overflow-y-auto whitespace-pre-wrap text-[15px] leading-[1.7]"
                  >
                    {current.summary}
                  </div>
                  <div data-detail className="mt-5 flex flex-wrap gap-2">
                    {current.githubUrl ? (
                      <SourceLink href={current.githubUrl} icon={<GitHubIcon size={14} />} />
                    ) : null}
                    {current.xUrl ? (
                      <SourceLink href={current.xUrl} icon={<XIcon size={12} />} />
                    ) : null}
                    {!current.githubUrl && !current.xUrl ? (
                      <p className="text-[13px] text-fg-subtle">No links supplied.</p>
                    ) : null}
                  </div>

                  <fieldset
                    data-detail
                    className="mt-6 rounded-[var(--radius-control)] border border-border p-4"
                  >
                    <legend className="px-1 text-[12px] font-medium text-fg-muted">
                      Reviewer checklist
                    </legend>
                    <div className="space-y-2.5">
                      {CHECKS.map((label, i) => (
                        <label
                          key={label}
                          className="flex cursor-pointer items-start gap-3 text-[13.5px]"
                        >
                          <input
                            type="checkbox"
                            checked={checks[i]}
                            onChange={(e) =>
                              setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))
                            }
                            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                          />
                          <span className={checks[i] ? "text-fg" : "text-fg-muted"}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="sticky bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur sm:p-5">
                  {rejecting ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNote(t)}
                            className="press max-w-full truncate rounded-full border border-border px-3 py-1 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg"
                          >
                            {t.split(".")[0]}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        ref={noteRef}
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        placeholder="Tell the creator exactly what to fix. They read this on their dashboard."
                        aria-label="Reason for sending back"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="danger"
                          loading={busy}
                          disabled={note.trim().length < 10}
                          onClick={() => void decide("reject")}
                        >
                          Send back with note
                        </Button>
                        <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                          Cancel
                        </Button>
                        <span className="ml-auto font-mono text-[11.5px] text-fg-subtle">
                          {note.length}/500
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        loading={busy}
                        onClick={() => void decide("approve")}
                        className="w-full sm:w-auto"
                      >
                        <CheckIcon size={15} />
                        Approve and publish
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRejecting(true);
                          requestAnimationFrame(() => noteRef.current?.focus());
                        }}
                        disabled={busy}
                        className="w-full sm:w-auto"
                      >
                        Send back
                      </Button>
                      <span className="text-[12px] text-fg-subtle sm:ml-auto">
                        {checks.filter(Boolean).length}/{CHECKS.length} checks ticked
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SourceLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="press inline-flex h-9 items-center gap-2 rounded-full border border-border px-3.5 text-[12.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      {icon}
      <span className="max-w-[28ch] truncate">{href.replace(/^https:\/\/(www\.)?/, "")}</span>
      <ExternalIcon size={12} className="text-fg-subtle" />
    </a>
  );
}
