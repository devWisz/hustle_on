import { api } from "./api/client";
import type { Donation, Note, Page, Timelapse } from "./types";

/**
 * The pages after the first one.
 *
 * A server component renders the first page of every list into the HTML (see
 * `src/lib/data.ts`). When a reader asks for more, the browser fetches the next
 * page from here using the cursor the API handed the server. These functions
 * live apart from `src/lib/data.ts` because that module is `server-only` and a
 * client component cannot import it.
 *
 * The page sizes are shared with the server so page two continues at the same
 * bound page one was cut to. They mirror the API's own defaults for these
 * endpoints; passing them explicitly keeps the two halves of a list in step if
 * a default ever changes.
 */
export const CREATOR_SESSIONS_PAGE_SIZE = 24;
export const MY_SUBMISSIONS_PAGE_SIZE = 50;
export const MY_SPONSORSHIPS_PAGE_SIZE = 50;
export const SUPPORTERS_PAGE_SIZE = 20;
export const NOTES_PAGE_SIZE = 100;

function pagePath(path: string, limit: number, cursor?: string): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `${path}?${params}`;
}

/** A creator's published sessions, newest first. */
export function fetchCreatorSessions(handle: string, cursor?: string): Promise<Page<Timelapse>> {
  return api<Page<Timelapse>>(
    pagePath(`/v1/creators/${handle}/timelapses`, CREATOR_SESSIONS_PAGE_SIZE, cursor),
  );
}

/** Everything the signed-in creator has submitted, in any state. */
export function fetchMySubmissions(cursor?: string): Promise<Page<Timelapse>> {
  return api<Page<Timelapse>>(pagePath("/v1/me/timelapses", MY_SUBMISSIONS_PAGE_SIZE, cursor));
}

/** Sponsorships the signed-in creator has received. */
export function fetchMySponsorships(cursor?: string): Promise<Page<Donation>> {
  return api<Page<Donation>>(pagePath("/v1/me/donations", MY_SPONSORSHIPS_PAGE_SIZE, cursor));
}

/** The supporters under a published session. */
export function fetchSupporters(slug: string, cursor?: string): Promise<Page<Donation>> {
  return api<Page<Donation>>(
    pagePath(`/v1/timelapses/${slug}/donations`, SUPPORTERS_PAGE_SIZE, cursor),
  );
}

/** The peer notes on a published session, newest first. */
export function fetchTimelapseNotes(slug: string, cursor?: string): Promise<Page<Note>> {
  return api<Page<Note>>(pagePath(`/v1/timelapses/${slug}/notes`, NOTES_PAGE_SIZE, cursor));
}
