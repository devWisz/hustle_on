"use client";

import { fetchCreatorSessions } from "@/lib/pagination";
import type { Timelapse } from "@/lib/types";
import { PagedList } from "../ui";
import { TimelapseGrid } from "./grid";

/**
 * A creator's sessions: the first page arrives from the server (see
 * `getCreator` in `src/lib/data.ts`), later pages are fetched in the browser.
 * The grid itself stays presentational; only the paging lives here.
 */
export function CreatorSessions({
  handle,
  initial,
  initialCursor,
}: {
  handle: string;
  initial: Timelapse[];
  initialCursor?: string;
}) {
  return (
    <PagedList
      initial={initial}
      initialCursor={initialCursor}
      load={(cursor) => fetchCreatorSessions(handle, cursor)}
      label="Load more sessions"
      errorText="More sessions could not be loaded. Try again."
      className="mt-14 flex flex-col items-center gap-3"
      render={(items) => <TimelapseGrid items={items} />}
    />
  );
}
