import type { Video } from "@/lib/types";
import { cx } from "@/lib/format";

/**
 * A year of published sessions, as a calendar.
 *
 * This is the one view that makes a track record legible at a glance, which is
 * the whole premise of the product: consistency over time is the thing a
 * sponsor or a client is actually assessing, and a list of twelve cards cannot
 * show it.
 *
 * Intensity is keyed to hours worked rather than session count, because two
 * ten-hour days are not the same record as two ten-minute ones.
 *
 * Rendered on the server from data the profile already fetched, so it costs no
 * request and no JavaScript.
 */

const WEEKS = 53;
const DAY_MS = 86_400_000;

/** Thresholds in minutes. Four steps is as many as stay distinguishable. */
const LEVELS = [0, 60, 180, 360] as const;

interface Day {
  /** Local calendar date, `YYYY-MM-DD`. */
  key: string;
  date: Date;
  minutes: number;
  sessions: number;
}

/** A column. `start` is carried explicitly so month labels never index into
 *  `days` and have to reason about whether the array is populated. */
interface Week {
  start: Date;
  days: Day[];
}

/** A local date key. `toISOString` would bucket by UTC and shift the day. */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function level(minutes: number): number {
  if (minutes <= LEVELS[0]) return 0;
  if (minutes < LEVELS[1]) return 1;
  if (minutes < LEVELS[2]) return 2;
  if (minutes < LEVELS[3]) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-surface-raised border-border",
  "bg-accent/20 border-transparent",
  "bg-accent/40 border-transparent",
  "bg-accent/70 border-transparent",
  "bg-accent border-transparent",
] as const;

function hours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

/**
 * Builds the grid: 53 columns of 7 days, ending on the current week, with the
 * final column holding today. Weeks start on Sunday to match the day labels.
 */
function buildGrid(videos: Video[]): {
  weeks: Week[];
  totalMinutes: number;
  activeDays: number;
} {
  const byDay = new Map<string, { minutes: number; sessions: number }>();

  for (const video of videos) {
    const stamp = video.publishedAt ?? video.createdAt;
    if (!stamp) continue;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const entry = byDay.get(key) ?? { minutes: 0, sessions: 0 };
    entry.minutes += video.sessionMinutes || 0;
    entry.sessions += 1;
    byDay.set(key, entry);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0); // Midday avoids daylight-saving edges on ±1 day.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // Saturday of the current week.
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));

  const weeks: Week[] = [];
  let totalMinutes = 0;
  let activeDays = 0;

  for (let w = 0; w < WEEKS; w++) {
    const days: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      const key = dayKey(date);
      const entry = byDay.get(key);
      const minutes = entry?.minutes ?? 0;
      if (minutes > 0) {
        totalMinutes += minutes;
        activeDays += 1;
      }
      days.push({ key, date, minutes, sessions: entry?.sessions ?? 0 });
    }
    weeks.push({ start: new Date(start.getTime() + w * 7 * DAY_MS), days });
  }

  return { weeks, totalMinutes, activeDays };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function SessionHeatmap({
  videos,
  name,
}: {
  videos: Video[];
  name: string;
}) {
  const { weeks, totalMinutes, activeDays } = buildGrid(videos);
  const today = dayKey(new Date());

  // A month label sits above the first week that starts a new month, so the
  // labels line up with where the month actually begins in the grid.
  const monthLabels = weeks.map((week, index) => {
    const previous = weeks[index - 1];
    if (!previous) return null;
    return week.start.getMonth() !== previous.start.getMonth()
      ? MONTHS[week.start.getMonth()]
      : null;
  });

  return (
    <section aria-labelledby="activity-heading">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="activity-heading" className="text-[17px] font-semibold">
          Activity
        </h2>
        <p className="text-[13px] text-fg-muted">
          {activeDays > 0 ? (
            <>
              <span className="font-medium text-fg tabular-nums">
                {hours(totalMinutes)}
              </span>{" "}
              of work across{" "}
              <span className="font-medium text-fg tabular-nums">
                {activeDays}
              </span>{" "}
              {activeDays === 1 ? "day" : "days"} this year
            </>
          ) : (
            "No sessions published in the last year"
          )}
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        {/* The weekday key sits outside the scroll port so it stays put while
            the grid moves, without overlapping a column. */}
        <div className="flex" aria-hidden>
          <div className="mr-1.5 flex shrink-0 flex-col gap-[3px] pt-[15px] text-right">
            {["Mon", "Wed", "Fri"].map((label, index) => (
              <span
                key={label}
                className="text-[9px] leading-[11px] text-fg-subtle"
                style={{ marginTop: index === 0 ? 0 : 11 }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* A full year rarely fits the column, so the grid scrolls.
              `dir="rtl"` makes it open at its right edge — the current week —
              with no JavaScript; the inner grid is switched back to `ltr` so
              the columns still run oldest to newest. */}
          <div dir="rtl" className="scroll-x min-w-0 flex-1">
            <div dir="ltr" className="flex w-max gap-[3px]">
              {weeks.map((week, index) => (
                <div
                  key={dayKey(week.start)}
                  className="flex shrink-0 flex-col gap-[3px]"
                >
                  <span className="h-[12px] text-[9px] leading-[12px] text-fg-subtle">
                    {monthLabels[index] ?? ""}
                  </span>
                  {week.days.map((day) => {
                    const future = day.date > new Date();
                    return (
                      <span
                        key={day.key}
                        title={
                          future
                            ? undefined
                            : day.sessions > 0
                              ? `${hours(day.minutes)} across ${day.sessions} ${day.sessions === 1 ? "session" : "sessions"} on ${day.key}`
                              : `No sessions on ${day.key}`
                        }
                        className={cx(
                          "h-[11px] w-[11px] rounded-[2px] border",
                          future
                            ? "border-transparent bg-transparent"
                            : LEVEL_CLASS[level(day.minutes)],
                          day.key === today ? "ring-1 ring-fg-subtle" : "",
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-fg-subtle"
          aria-hidden
        >
          <span>Less</span>
          {LEVEL_CLASS.map((cls, index) => (
            <span
              key={index}
              className={cx("h-[11px] w-[11px] rounded-[2px] border", cls)}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <p className="sr-only">
        {activeDays > 0
          ? `${name} published sessions on ${activeDays} days in the last year, totalling ${hours(totalMinutes)} of recorded work.`
          : `${name} has not published a session in the last year.`}
      </p>
    </section>
  );
}
