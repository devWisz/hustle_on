"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Flip } from "gsap/Flip";
import type { Timelapse } from "@/lib/types";
import { CATEGORIES, matchesCategory } from "@/lib/tags";
import { cx } from "@/lib/format";
import { MOTION, ScrollTrigger, gsap, useGSAP } from "../motion/gsap";
import { EmptyState } from "../ui/layout";
import { FilmIcon } from "../ui/icons";
import { TimelapseCard } from "./card";

if (typeof window !== "undefined") gsap.registerPlugin(Flip);

export const FEED_SORTS = [
  { value: "", label: "Newest" },
  { value: "funded", label: "Most funded" },
  { value: "watched", label: "Most watched" },
  { value: "longest", label: "Longest" },
] as const;

export type FeedSort = (typeof FEED_SORTS)[number]["value"];

export function parseSort(value: string | string[] | undefined): FeedSort {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_SORTS.find((s) => s.value === first)?.value ?? "";
}

export function Feed({
  items,
  sort,
  demo,
  emptyAction,
}: {
  items: Timelapse[];
  sort: FeedSort;
  demo: boolean;
  emptyAction?: React.ReactNode;
}) {
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
            onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.5 }),
            onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.3 }),
          });
          flipState.current = null;
          return;
        }
        gsap.set(el, { autoAlpha: 1 });
        gsap.set(el.children, { autoAlpha: 0 });
        ScrollTrigger.batch(el.children, {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(batch, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.9, clearProps: "transform" }),
        });
      });
    },
    { dependencies: [topic, sort, items.length], scope: grid },
  );

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-border py-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Sort" className="scroll-x -mx-4 flex gap-1 px-4 lg:mx-0 lg:px-0">
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
                  selected ? "bg-inverse text-inverse-fg" : "text-fg-muted hover:bg-surface-raised hover:text-fg",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        {topics.length > 2 ? (
          <div role="group" aria-label="Filter by topic" className="scroll-x -mx-4 flex gap-1.5 px-4 lg:mx-0 lg:px-0">
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
                  <span className="ml-1.5 font-mono text-[11px] text-fg-subtle">{counts[c.id]}</span>
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
      </div>
    </div>
  );
}
