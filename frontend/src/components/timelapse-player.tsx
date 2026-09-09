"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Timelapse } from "@/lib/types";

/**
 * The video player.
 *
 * It is a plain `<video controls>`. A custom transport would mean rebuilding
 * keyboard control, captions, picture-in-picture and the OS media keys, all of
 * which the native element already does correctly.
 */
export function TimelapsePlayer({ timelapse }: { timelapse: Timelapse }) {
  const counted = useRef(false);

  // A view is recorded once the person has actually watched a few seconds,
  // not on page load: a bounce is not a view, and the API deduplicates the
  // rest per day anyway.
  useEffect(() => {
    if (!timelapse.playbackUrl) return;
    const timer = setTimeout(() => {
      if (counted.current) return;
      counted.current = true;
      void api(`/v1/timelapses/${timelapse.slug}/views`, { method: "POST" }).catch(() => {
        // A missed view count is not worth telling anybody about.
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [timelapse.slug, timelapse.playbackUrl]);

  if (!timelapse.playbackUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface-raised">
        <p className="text-sm text-fg-muted">This timelapse has no video attached yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-black shadow-[var(--shadow-raised)]">
      <video
        controls
        preload="metadata"
        playsInline
        poster={timelapse.thumbnailUrl}
        className="aspect-video w-full"
      >
        <source src={timelapse.playbackUrl} />
        Your browser cannot play this video.
      </video>
    </div>
  );
}
