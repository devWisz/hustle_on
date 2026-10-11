"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { cx, formatSession, timeAgo } from "@/lib/format";
import { formatWait, reviewFlags, waitingMinutes } from "@/lib/review";
import type { AdminMember, Timelapse } from "@/lib/types";
import { useToast } from "../layout/toast";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import { Avatar, Badge, Button, EmptyState, SearchField, Select, Textarea } from "../ui";
import { ArrowLeftIcon, CheckIcon, ExternalIcon, GitHubIcon, InboxIcon, XIcon } from "../ui/icons";
import { AdminPage, Panel, ShortcutLegend, memberIndex } from "./console";

const TEMPLATES = [
  "The write-up does not say what changed or why. Describe what you set out to do and what you ended up with.",
  "There is no link to the result. Add a link to the finished result so a reviewer can check the work.",
  "The recording does not appear to match the write-up. Make sure the clip shows the session described.",
  "The session length looks off compared to the recording. Give the real time spent on the work.",
];

const CHECKS = [
  "The write-up describes the work in the recording",
  "Links point at the result, or the work stands on its own",
  "Nothing in it is someone else's work",
];

/** The rejection rule, unchanged: the API refuses anything outside this too. */
const NOTE_MIN = 10;
const NOTE_MAX = 500;

const SHORTCUTS = [
  { keys: ["A"], label: "approve and publish" },
  { keys: ["R"], label: "send back with a note" },
  { keys: ["J"], label: "next submission" },
  { keys: ["K"], label: "previous submission" },
  { keys: ["Esc"], label: "close this submission" },
];

type Sort = "oldest" | "newest" | "longest";

/**
 * One submission, decided without leaving the desk.
 *
 * The recording, the whole write-up and the creator's record sit together in the
 * pane on the right, so a decision never depends on a second tab. Every action on
 * this page is a real button or a documented key: `A` approves, `R` opens the note
 * and puts the cursor in it, `J`/`K` (or the arrow keys) move, and Escape closes
 * the pane. None of them fire while the reviewer is typing.
 *
 * A decision removes the row and the desk moves on by itself, saying which
 * submission it moved to — the next thing to read is on screen before the
 * previous one is forgotten.
 */
export function ReviewDesk({
  initial,
  initialId,
  members = [],
}: {
  initial: Timelapse[];
  initialId?: string;
  members?: AdminMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [queue, setQueue] = useState(initial);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("oldest");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialId));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState({ approved: 0, rejected: 0 });
  const detail = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const memberById = useMemo(() => memberIndex(members), [members]);

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

  const current = visible.find((t) => t.id === selectedId);
  const index = current ? visible.indexOf(current) : -1;
  const currentId = current?.id;
  const member = current ? memberById.get(current.creator.id) : undefined;

  // The pane is per-submission state, so it is cleared the moment the submission
  // changes: a half-written note must never attach itself to the wrong creator.
  useEffect(() => {
    setRejecting(false);
    setNote("");
    setChecks(CHECKS.map(() => false));
  }, [currentId]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from("[data-detail]", { y: 14, autoAlpha: 0, stagger: 0.05, duration: 0.5 });
      });
    },
    { scope: detail, dependencies: [currentId] },
  );

  const select = useCallback((id: string | undefined) => {
    setSelectedId(id);
    setMobileDetail(Boolean(id));
  }, []);

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const at = index === -1 ? (delta > 0 ? -1 : 0) : index;
      const next = visible[Math.min(visible.length - 1, Math.max(0, at + delta))];
      if (next) select(next.id);
    },
    [visible, index, select],
  );

  const openRejection = useCallback(() => {
    setRejecting(true);
    requestAnimationFrame(() => noteRef.current?.focus());
  }, []);

  const closeDetail = useCallback(() => {
    setRejecting(false);
    setSelectedId(undefined);
    setMobileDetail(false);
  }, []);

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      if (!current || busy) return;
      if (action === "reject" && note.trim().length < NOTE_MIN) return;
      setBusy(true);
      // Read the neighbour before the row leaves the list, so the desk can name
      // where it is about to put the reviewer.
      const following = visible[index + 1] ?? visible[index - 1];
      try {
        await api(`/v1/admin/timelapses/${current.id}/${action}`, {
          method: "POST",
          body: action === "reject" ? { note: note.trim() } : undefined,
        });
        setQueue((q) => q.filter((t) => t.id !== current.id));
        setSelectedId(following?.id);
        setMobileDetail(Boolean(following));
        setRejecting(false);
        setNote("");
        setDecided((d) => ({
          ...d,
          [action === "approve" ? "approved" : "rejected"]:
            d[action === "approve" ? "approved" : "rejected"] + 1,
        }));
        const done = action === "approve" ? "Approved and published." : "Sent back with your note.";
        toast.success(
          following ? `${done} Next: ${following.title}.` : `${done} That is the queue.`,
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el instanceof HTMLElement ? el.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape" && el instanceof HTMLElement) {
          e.preventDefault();
          el.blur();
          setRejecting(false);
        }
        return;
      }
      // A letter key on a focused control is that control's, not the desk's.
      if (el instanceof HTMLElement && el.closest("button, a, [role='button']")) return;

      const next = e.key === "j" || e.key === "J" || e.key === "ArrowDown";
      const previous = e.key === "k" || e.key === "K" || e.key === "ArrowUp";
      if (next || previous) {
        e.preventDefault();
        move(next ? 1 : -1);
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void decide("approve");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        openRejection();
      } else if (e.key === "Escape") {
        closeDetail();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, decide, openRejection, closeDetail]);

  const flags = current ? reviewFlags(current) : [];
  const noteLength = note.trim().length;

  return (
    <AdminPage
      title="Review desk"
      description="Nothing reaches the feed without a decision here. Read the write-up against the recording, then decide."
    >
      <ShortcutLegend items={SHORTCUTS} className="text-fg-muted" />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fg-muted">
        <span>
          <span className="font-mono tabular-nums text-fg">{queue.length}</span> waiting
        </span>
        <span>
          <span className="font-mono tabular-nums text-fg">{decided.approved}</span> approved and{" "}
          <span className="font-mono tabular-nums text-fg">{decided.rejected}</span> sent back this
          session
        </span>
        <span aria-live="polite" className="text-fg-subtle">
          {current ? `Reading: ${current.title}` : "No submission open"}
        </span>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={<InboxIcon size={18} />}
          title="The queue is clear"
          description="Every submission has a decision. New ones appear here as they arrive."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
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
            <ul
              id="review-queue"
              aria-label="Submissions"
              className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1"
            >
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
                      <span className="line-clamp-2 block text-[14px] font-medium leading-snug">
                        {t.title}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-[12px] text-fg-subtle">
                        <Avatar name={t.creator.displayName} src={t.creator.avatarUrl} size={18} />
                        <span className="truncate">{t.creator.displayName}</span>
                        <span className="ml-auto shrink-0 font-mono">
                          {formatWait(waitingMinutes(t))}
                        </span>
                      </span>
                      {itemFlags.length ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {itemFlags.map((f) => (
                            <Badge key={f.label} tone={f.tone} className="h-5 px-2 text-[10.5px]">
                              {f.label}
                            </Badge>
                          ))}
                        </span>
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
                onClick={() => {
                  setMobileDetail(false);
                  setSelectedId(undefined);
                }}
                className="mb-3 inline-flex items-center gap-2 text-[13px] text-fg-muted lg:hidden"
              >
                <ArrowLeftIcon size={15} />
                Back to the queue
              </button>

              <Panel as="section" label="review-detail-title" rows={false}>
                <VideoStage timelapse={current} />

                <div className="p-5 sm:p-6">
                  <div
                    data-detail
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-muted"
                  >
                    <Avatar
                      name={current.creator.displayName}
                      src={current.creator.avatarUrl}
                      size={22}
                    />
                    <span className="font-medium text-fg">{current.creator.displayName}</span>
                    <span>@{current.creator.handle}</span>
                    <span aria-hidden>·</span>
                    <span>waiting {formatWait(waitingMinutes(current))}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {current.submittedAt
                        ? `submitted ${timeAgo(current.submittedAt)}`
                        : `created ${timeAgo(current.createdAt)}`}
                    </span>
                    {current.sessionMinutes ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formatSession(current.sessionMinutes)}</span>
                      </>
                    ) : null}
                  </div>

                  <h2
                    id="review-detail-title"
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

                  <CreatorStanding timelapse={current} member={member} />

                  <section data-detail className="mt-5">
                    <h3 className="text-[12px] font-medium text-fg-muted">The write-up</h3>
                    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7]">
                      {current.summary}
                    </p>
                  </section>

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

                <div className="border-t border-border p-4 sm:p-5">
                  {rejecting ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setNote(t);
                              noteRef.current?.focus();
                            }}
                            className="press rounded-full border border-border px-3 py-1 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg"
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
                        maxLength={NOTE_MAX}
                        placeholder="Tell the creator exactly what to fix. They read this on their dashboard."
                        aria-label="Reason for sending back"
                        aria-describedby="review-note-help"
                      />
                      <p id="review-note-help" className="text-[12px] text-fg-subtle">
                        Required, between {NOTE_MIN} and {NOTE_MAX} characters.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="danger"
                          loading={busy}
                          disabled={noteLength < NOTE_MIN}
                          onClick={() => void decide("reject")}
                        >
                          Send back with note
                        </Button>
                        <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                          Cancel
                        </Button>
                        <span className="ml-auto font-mono text-[11.5px] text-fg-subtle">
                          {note.length}/{NOTE_MAX}
                          {noteLength > 0 && noteLength < NOTE_MIN
                            ? ` · ${NOTE_MIN - noteLength} more`
                            : ""}
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
                        onClick={openRejection}
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
              </Panel>
            </div>
          ) : (
            <Panel className={cx("p-8", !mobileDetail && "hidden lg:block")}>
              <p className="text-[14px] text-fg-muted">
                Nothing is open. Pick a submission from the list, or press{" "}
                <span className="kbd">J</span> to start at the oldest.
              </p>
            </Panel>
          )}
        </div>
      )}
    </AdminPage>
  );
}

/**
 * The recording, inline.
 *
 * A submission whose playback URL is missing or refuses to load says so in words
 * and still offers the raw link, because "the video will not play here" and "there
 * is no video" are different problems and the reviewer has to be able to tell them
 * apart before deciding.
 */
function VideoStage({ timelapse }: { timelapse: Timelapse }) {
  const [failed, setFailed] = useState(false);
  const missing = !timelapse.playbackUrl;
  const broken = !missing && failed;

  return (
    <div data-detail className="bg-black">
      {missing || broken ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-[13.5px] text-white/80">
            {missing
              ? "No recording is attached to this submission."
              : "This recording did not load in the page."}
          </p>
          <p className="max-w-md text-[12.5px] leading-relaxed text-white/60">
            {missing
              ? "You can still decide on the write-up, but the creator was asked for a recording."
              : "Open it in a new tab to watch it before deciding."}
          </p>
          {timelapse.playbackUrl ? (
            <a
              href={timelapse.playbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 text-[12.5px] text-white/90 hover:border-white/60"
            >
              Open the recording
              <ExternalIcon size={12} />
            </a>
          ) : null}
        </div>
      ) : (
        <video
          key={timelapse.id}
          src={timelapse.playbackUrl}
          poster={timelapse.thumbnailUrl || undefined}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="aspect-video w-full"
        />
      )}
    </div>
  );
}

/**
 * Who the decision is about: their handle and what has become of their work so
 * far, read from the members the console already holds rather than a second call.
 */
function CreatorStanding({ timelapse, member }: { timelapse: Timelapse; member?: AdminMember }) {
  const stats = member
    ? [
        { label: "Published", value: member.timelapseCount },
        { label: "Rejected", value: member.rejected },
        { label: "In review", value: member.inReview },
      ]
    : [];

  return (
    <section
      data-detail
      className="mt-5 rounded-[var(--radius-control)] border border-border bg-surface-raised/50 p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar name={timelapse.creator.displayName} src={timelapse.creator.avatarUrl} size={30} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium">{timelapse.creator.displayName}</p>
          <p className="truncate font-mono text-[12px] text-fg-subtle">
            @{timelapse.creator.handle}
          </p>
        </div>
      </div>
      {stats.length ? (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[11.5px] text-fg-subtle">{s.label}</dt>
              <dd className="mt-0.5 font-mono text-[14px] tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-[12.5px] text-fg-subtle">
          Their record could not be loaded; decide on what is above.
        </p>
      )}
      <p className="mt-3 text-[12.5px] text-fg-subtle">
        <a
          href={`/creator/${encodeURIComponent(timelapse.creator.handle)}`}
          className="link-underline text-fg-muted hover:text-fg"
        >
          Open their public profile
        </a>
      </p>
    </section>
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
