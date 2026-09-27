"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { Flip } from "gsap/Flip";
import type { Page, Timelapse } from "@/lib/types";
import { CATEGORIES, matchesCategory } from "@/lib/tags";
import { cx } from "@/lib/format";
import { FEED_SORTS, type FeedSort } from "@/lib/feed";
import { MOTION, ScrollTrigger, gsap, useGSAP } from "../motion/gsap";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/layout";
import { FilmIcon } from "../ui/icons";
import { TimelapseCard } from "./card";

if (typeof window !== "undefined") gsap.registerPlugin(Flip);

export function Feed({
  items: firstPage,
  sort,
  demo,
  nextCursor: firstCursor,
  pageSize,
  emptyAction,
}: {
  items: Timelapse[];
  sort: FeedSort;
  demo: boolean;
  nextCursor?: string;
  pageSize: number;
  emptyAction?: React.ReactNode;
}) {
  const [items, setItems] = useState(firstPage);
  const [cursor, setCursor] = useState(firstCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setItems(firstPage);
    setCursor(firstCursor);
  }, [firstPage, firstCursor]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), cursor });
      if (sort) params.set("sort", sort);
      const page = await api<Page<Timelapse>>(`/v1/timelapses?${params}`);
      setItems((current) => {
        const seen = new Set(current.map((t) => t.id));
        return [...current, ...page.items.filter((t) => !seen.has(t.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }
  const [topic, setTopic] = useState("all");
  const grid = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of CATEGORIES) out[c.id] = items.filter((t) => matchesCategory(t, c.id)).length;
    return out;
  }, [items]);

  const topics = CATEGORIES.filter((c) => c.id === "all" || (counts[c.id] ?? 0) > 0);
  const visible = items.filter((t) => matchesCategory(t, topic));

  function choose(id: string) {
    if (id === topic) return;
    if (grid.current) flipState.current = Flip.getState(grid.current.children);
    setTopic(id);
  }

  useGSAP(
    () => {
      const el = grid.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        if (flipState.current) {
          Flip.from(flipState.current, {
            duration: 0.6,
            ease: "power3.inOut",
            absolute: true,
            onEnter: (els) =>
              gsap.fromTo(
                els,
                { autoAlpha: 0, scale: 0.94 },
                { autoAlpha: 1, scale: 1, duration: 0.5 },
              ),
            onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.3 }),
          });
          flipState.current = null;
          return;
        }
        gsap.set(el, { autoAlpha: 1 });
        const fresh = Array.from(el.children).filter(
          (child) => !(child as HTMLElement).dataset.shown,
        );
        if (fresh.length === 0) return;
        gsap.set(fresh, { autoAlpha: 0 });
        ScrollTrigger.batch(fresh, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => {
            batch.forEach((child) => ((child as HTMLElement).dataset.shown = "1"));
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 40 },
              { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.9, clearProps: "transform" },
            );
          },
        });
      });
    },
    { dependencies: [topic, sort, items.length], scope: grid },
  );

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-border py-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Sort"
          className="scroll-x -mx-4 flex gap-1 px-4 lg:mx-0 lg:px-0"
        >
          {FEED_SORTS.map((s) => {
            const selected = s.value === sort;
            return (
              <Link
                key={s.value || "newest"}
                href={s.value ? `/?sort=${s.value}#feed` : "/#feed"}
                scroll={false}
                role="tab"
                aria-selected={selected}
                className={cx(
                  "press shrink-0 rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors",
                  selected
                    ? "bg-inverse text-inverse-fg"
                    : "text-fg-muted hover:bg-surface-raised hover:text-fg",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        {topics.length > 2 ? (
          <div
            role="group"
            aria-label="Filter by topic"
            className="scroll-x -mx-4 flex gap-1.5 px-4 lg:mx-0 lg:px-0"
          >
            {topics.map((c) => {
              const selected = c.id === topic;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-pressed={selected}
                  className={cx(
                    "press shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    selected
                      ? "border-fg bg-surface text-fg"
                      : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  {c.label}
                  <span className="ml-1.5 font-mono text-[11px] text-fg-subtle">
                    {counts[c.id]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-10">
        {visible.length > 0 ? (
          <div
            ref={grid}
            data-reveal=""
            className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((t) => (
              <div key={t.id} data-flip-id={t.id}>
                <TimelapseCard timelapse={t} demo={demo} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FilmIcon size={18} />}
            title={items.length ? "Nothing in this topic yet" : "Nothing published yet"}
            description={
              items.length
                ? "Try another topic, or clear the filter to see everything."
                : "Every session here has been read by a person. The first ones are on their way."
            }
            action={emptyAction}
          />
        )}

        {!demo && cursor ? (
          <div className="mt-14 flex flex-col items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              loading={loadingMore}
              onClick={() => void loadMore()}
            >
              Load more sessions
            </Button>
            {loadError ? (
              <p role="alert" className="text-[13px] text-danger">
                More sessions could not be loaded. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
