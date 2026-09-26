"use client";

import { useRef, useState } from "react";
import type { ActivityDay } from "@/lib/types";
import { cx } from "@/lib/format";
import { MOTION, gsap, useGSAP } from "../motion/gsap";

const SERIES = [
  { key: "approved", label: "Approved", color: "var(--chart-1)" },
  { key: "rejected", label: "Sent back", color: "var(--chart-2)" },
] as const;

function dayLabel(iso: string, long = false) {
  return new Intl.DateTimeFormat("en", long ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" }).format(new Date(iso));
}

export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);

  const max = Math.max(1, ...days.map((d) => d.approved + d.rejected));
  const top = Math.ceil(max / 4) * 4;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];

  useGSAP(
    () => {
      if (view !== "chart") return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from("[data-bar]", {
          scaleY: 0,
          transformOrigin: "50% 100%",
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.015,
          scrollTrigger: { trigger: plot.current, start: "top 85%", once: true },
        });
      });
    },
    { scope: plot, dependencies: [view] },
  );

  const hovered = active === null ? null : days[active];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-[12.5px] text-fg-muted" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <div role="tablist" aria-label="Chart view" className="flex rounded-full bg-surface-raised p-1 text-[12px] font-medium">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx(
                "rounded-full px-3 py-1 capitalize transition-colors",
                view === v ? "bg-surface text-fg shadow-[var(--shadow-card)]" : "text-fg-subtle hover:text-fg",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <div ref={plot} className="relative mt-6 pl-8">
          <div className="relative h-52 sm:h-60">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-border"
                style={{ bottom: `${(t / top) * 100}%` }}
              >
                <span className="absolute -left-8 -translate-y-1/2 font-mono text-[10.5px] text-fg-subtle">{t}</span>
              </div>
            ))}

            <div className="absolute inset-0 flex items-end gap-[2px]" onPointerLeave={() => setActive(null)}>
              {days.map((d, i) => {
                const total = d.approved + d.rejected;
                return (
                  <button
                    key={d.date}
                    type="button"
                    aria-label={`${dayLabel(d.date, true)}: ${d.approved} approved, ${d.rejected} sent back`}
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="group relative flex h-full flex-1 flex-col justify-end focus-visible:outline-offset-0"
                  >
                    <span
                      data-bar
                      className={cx("flex w-full flex-col gap-[2px] transition-opacity", active !== null && active !== i && "opacity-40")}
                      style={{ height: `${(total / top) * 100}%` }}
                    >
                      {d.rejected > 0 ? (
                        <span
                          className="w-full rounded-t-[4px]"
                          style={{ flexGrow: d.rejected, background: "var(--chart-2)" }}
                        />
                      ) : null}
                      {d.approved > 0 ? (
                        <span
                          className={cx("w-full", d.rejected > 0 ? "" : "rounded-t-[4px]")}
                          style={{ flexGrow: d.approved, background: "var(--chart-1)" }}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {hovered && active !== null ? (
              <div
                role="status"
                className="pointer-events-none absolute bottom-full z-10 mb-2 w-44 -translate-x-1/2 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-raised)]"
                style={{ left: `clamp(88px, ${((active + 0.5) / days.length) * 100}%, calc(100% - 88px))` }}
              >
                <p className="text-[11.5px] text-fg-subtle">{dayLabel(hovered.date, true)}</p>
                {SERIES.map((s) => (
                  <p key={s.key} className="mt-1.5 flex items-center justify-between gap-3 text-[12px] text-fg-muted">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-fg">{hovered[s.key]}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10.5px] text-fg-subtle">
            <span>{days[0] ? dayLabel(days[0].date) : ""}</span>
            <span>{days[Math.floor(days.length / 2)] ? dayLabel(days[Math.floor(days.length / 2)]!.date) : ""}</span>
            <span>Today</span>
          </div>
        </div>
      ) : (
        <div className="mt-6 max-h-72 overflow-auto rounded-[var(--radius-control)] border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-surface-raised text-[12px] text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Submitted</th>
                <th className="px-3 py-2 text-right font-medium">Approved</th>
                <th className="px-3 py-2 text-right font-medium">Sent back</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono tabular-nums">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-2 font-sans">{dayLabel(d.date, true)}</td>
                  <td className="px-3 py-2 text-right">{d.submitted}</td>
                  <td className="px-3 py-2 text-right">{d.approved}</td>
                  <td className="px-3 py-2 text-right">{d.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
