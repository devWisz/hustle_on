import Link from "next/link";
import type { Timelapse } from "@/lib/types";
import { formatSession } from "@/lib/format";
import { DemoTag } from "../demo/tag";
import { ThumbArtwork } from "../timelapse/thumb";

export function UpNext({ items, demo }: { items: Timelapse[]; demo: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="up-next-heading">
      <h2 id="up-next-heading" className="flex items-center gap-2 text-[15px] font-semibold">
        Up next
        {demo ? <DemoTag /> : null}
      </h2>
      <ul className="mt-3 space-y-1">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/watch/${t.slug}`}
              className="group -mx-2 flex gap-3 rounded-[var(--radius-control)] p-2 transition-colors hover:bg-surface-raised"
            >
              <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-raised">
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <ThumbArtwork seed={t.slug} title={t.title} creator={t.creator.displayName} />
                )}
              </span>
              <span className="min-w-0 py-0.5">
                <span className="line-clamp-2 text-[13.5px] font-medium leading-snug transition-colors group-hover:text-accent">
                  {t.title}
                </span>
                <span className="mt-1 block truncate text-[12px] text-fg-subtle">
                  {t.creator.displayName}
                  {t.sessionMinutes > 0 ? ` · ${formatSession(t.sessionMinutes)}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
