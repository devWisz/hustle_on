"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import type { Timelapse } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Badge, Button, EmptyState } from "../ui";
import { ArrowDownIcon, ArrowUpIcon, FilmIcon, PlayIcon } from "../ui/icons";

/** Which request is in flight: the verb, the session, or both. */
type Busy = { op: "move" | "remove" | "add"; id?: string };

const PLACEHOLDER_CAPACITY = 12;

/**
 * The shelf is a permutation, never an edit: reordering and removing both go
 * through the same explicit handler so every call leaves the set of ids intact
 * and only the order changes.
 */
function reorder(list: Timelapse[], id: string, to: number): Timelapse[] {
  const from = list.findIndex((t) => t.id === id);
  if (from < 0 || to < 0 || to >= list.length || to === from) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1) as [Timelapse];
  next.splice(to, 0, moved);
  return next;
}

export function FrontPage({
  initial,
  capacity,
  library,
}: {
  initial: Timelapse[];
  capacity: number;
  library: Timelapse[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<Busy | null>(null);

  const limit = capacity > 0 ? capacity : PLACEHOLDER_CAPACITY;
  const full = items.length >= limit;
  const shelfIds = new Set(items.map((t) => t.id));
  const candidates = library.filter((t) => !shelfIds.has(t.id));
  const working = busy !== null;

  async function move(t: Timelapse, to: number) {
    if (working) return;
    const before = items;
    const next = reorder(before, t.id, to);
    if (next === before) return;
    setBusy({ op: "move", id: t.id });
    setItems(next);
    try {
      // The API only accepts the whole shelf reordered, so the body is always
      // the full set even when one row moved by one place.
      await api("/v1/admin/featured", { method: "PUT", body: { ids: next.map((x) => x.id) } });
      toast.success(`"${t.title}" moved to ${to + 1}.`);
      router.refresh();
    } catch (err) {
      setItems(before);
      toast.error(err instanceof ApiError ? err.message : "That move did not go through.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: Timelapse) {
    if (working) return;
    const before = items;
    const next = before.filter((x) => x.id !== t.id);
    setBusy({ op: "remove", id: t.id });
    setItems(next);
    try {
      await api(`/v1/admin/timelapses/${t.id}/feature`, { method: "DELETE" });
      toast.success(`"${t.title}" is off the front page.`);
      router.refresh();
    } catch (err) {
      setItems(before);
      toast.error(err instanceof ApiError ? err.message : "That removal did not go through.");
    } finally {
      setBusy(null);
    }
  }

  async function add(t: Timelapse) {
    if (working || full) return;
    const before = items;
    setBusy({ op: "add", id: t.id });
    // An add lands at the end, so the rows do not move around under the cursor.
    setItems([...before, { ...t, featured: true, featuredRank: before.length + 1 }]);
    try {
      await api(`/v1/admin/timelapses/${t.id}/feature`, { method: "POST" });
      toast.success(`"${t.title}" added to the end of the front page.`);
      router.refresh();
    } catch (err) {
      setItems(before);
      toast.error(err instanceof ApiError ? err.message : "That addition did not go through.");
    } finally {
      setBusy(null);
    }
  }

  /** The session's name, as these controls read it out to a screen reader. */
  function name(t: Timelapse): string {
    return `"${t.title}"`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <p className="text-[13px] text-fg-muted">
          <span className="font-mono tabular-nums text-fg">{items.length}</span> of{" "}
          <span className="font-mono tabular-nums text-fg">{limit}</span> slots used
        </p>
        <span className="text-[12.5px] text-fg-subtle">
          {full
            ? "Full"
            : `${limit - items.length} ${limit - items.length === 1 ? "slot" : "slots"} open`}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
        This order is exactly what a visitor sees first on the homepage: the top row is the first
        session in the reel, and additions land at the end.
      </p>
      {items.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<PlayIcon size={18} />}
          title="Nothing is on the front page"
          description="The front page is the first thing a visitor sees, so it is kept to a hand-picked selection rather than everything published. Use Add to put a session on it, in the order you want it read."
        />
      ) : (
        <ol
          aria-label="Front page order"
          className="mt-5 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
        >
          {items.map((t, i) => (
            <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <span
                aria-hidden
                className="w-6 shrink-0 font-mono text-[13px] tabular-nums text-fg-subtle"
              >
                {i + 1}
              </span>
              <span className="sr-only">Position {i + 1}</span>

              <span className="aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-surface-raised">
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-fg-subtle">
                    <FilmIcon size={16} />
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/watch/${t.slug}`}
                    className="line-clamp-1 font-medium hover:text-accent"
                  >
                    {t.title}
                  </Link>
                  <Badge tone="accent">Featured</Badge>
                </span>
                <span className="mt-1 block truncate text-[12px] text-fg-subtle">
                  {t.creator.displayName}
                </span>
              </span>

              <span className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="px-2.5"
                  disabled={i === 0 || working}
                  loading={busy?.op === "move" && busy.id === t.id}
                  onClick={() => void move(t, i - 1)}
                  aria-label={`Move ${name(t)} up one place`}
                >
                  <ArrowUpIcon size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="px-2.5"
                  disabled={i === items.length - 1 || working}
                  loading={busy?.op === "move" && busy.id === t.id}
                  onClick={() => void move(t, i + 1)}
                  aria-label={`Move ${name(t)} down one place`}
                >
                  <ArrowDownIcon size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy?.op === "remove" && busy.id === t.id}
                  disabled={working && !(busy?.op === "remove" && busy.id === t.id)}
                  onClick={() => void remove(t)}
                  aria-label={`Remove ${name(t)} from the front page`}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="add-heading" className="mt-8">
        <h2 id="add-heading" className="text-[15px] font-semibold tracking-tight">
          Add a published session
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
          Published sessions that are not on the front page yet. Adding puts one at the end, so you
          can place it exactly where you want it with the arrows above.
        </p>

        {full ? (
          <p className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface-raised px-4 py-3 text-[13px] text-fg-muted">
            The front page holds {limit} sessions. Remove one to add another.
          </p>
        ) : candidates.length === 0 ? (
          <p className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface-raised px-4 py-3 text-[13px] text-fg-muted">
            Every published session is already on the front page.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            {candidates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4 sm:p-5">
                <span className="aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-surface-raised">
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-fg-subtle">
                      <FilmIcon size={14} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{t.title}</span>
                  <span className="block truncate text-[12px] text-fg-subtle">
                    {t.creator.displayName}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy?.op === "add" && busy.id === t.id}
                  disabled={working && !(busy?.op === "add" && busy.id === t.id)}
                  onClick={() => void add(t)}
                  aria-label={`Add ${name(t)} to the front page`}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
