import "server-only";
import { cache } from "react";
import { apiServer, apiServerAllPages, apiServerResult } from "./api/server";
import { hasDemoCookie } from "./demo/server";
import {
  SAMPLE_RECEIVED,
  SAMPLE_SELF,
  SAMPLE_STATS,
  SAMPLE_SUBMISSIONS,
  SAMPLE_TIMELAPSES,
  findSampleCreator,
  findSampleTimelapse,
  isSampleSlug,
  sampleDonations,
  sampleFeed,
  sampleNotes,
} from "./demo/content";
import type {
  ActivityDay,
  AdminAccess,
  AdminNote,
  AdminMember,
  AuditEntry,
  Donation,
  LedgerEntry,
  Note,
  Page,
  PublicUser,
  SelfUser,
  SessionResponse,
  Stats,
  Timelapse,
} from "./types";

export interface Viewer {
  user?: SelfUser;
  adminAccess?: AdminAccess;
  online: boolean;
  demo: boolean;
  uncertain: boolean;
}

const liveStats = cache(() => apiServer<Stats>("/v1/stats", 60));

export const getViewer = cache(async (): Promise<Viewer> => {
  const [session, cookie] = await Promise.all([
    apiServerResult<SessionResponse>("/v1/auth/session", 0),
    hasDemoCookie(),
  ]);
  const online = session.status !== 0;
  const uncertain = online && session.data === null;
  const user = session.data?.authenticated ? session.data.user : undefined;
  return {
    user,
    adminAccess: session.data?.adminAccess,
    online,
    uncertain,
    demo: !user && (cookie || !online),
  };
});

class ApiUnavailableError extends Error {
  constructor() {
    super("The API is busy. Try again in a moment.");
    this.name = "ApiUnavailableError";
  }
}

function signInOrRetry(viewer: Viewer): "signin" {
  if (viewer.uncertain) throw new ApiUnavailableError();
  return "signin";
}

export interface Sourced<T> {
  data: T;
  demo: boolean;
  nextCursor?: string;
}

export const FEED_PAGE_SIZE = 12;

export async function getStats(): Promise<Sourced<Stats> | null> {
  const [stats, viewer] = await Promise.all([liveStats(), getViewer()]);
  if (stats && stats.publishedTimelapses > 0) return { data: stats, demo: false };
  return viewer.demo ? { data: SAMPLE_STATS, demo: true } : null;
}

export async function getFeed(sort: string): Promise<Sourced<Timelapse[]>> {
  const query = `?limit=${FEED_PAGE_SIZE}${sort ? `&sort=${sort}` : ""}`;
  const [page, viewer] = await Promise.all([
    apiServer<Page<Timelapse>>(`/v1/timelapses${query}`),
    getViewer(),
  ]);
  const live = page?.items ?? [];
  if (live.length === 0 && viewer.demo) return { data: sampleFeed(sort), demo: true };
  return { data: live, demo: false, nextCursor: page?.nextCursor };
}

export interface WatchData {
  timelapse: Timelapse;
  payoutAddress?: string;
  donations: Donation[];
  notes: Note[];
  upNext: Timelapse[];
  signedIn: boolean;
  demo: boolean;
}

async function loadWatch(slug: string): Promise<WatchData | null> {
  const [live, viewer] = await Promise.all([
    apiServer<Timelapse>(`/v1/timelapses/${slug}`),
    getViewer(),
  ]);

  if (!live) {
    const sample = isSampleSlug(slug) && viewer.demo ? findSampleTimelapse(slug) : undefined;
    if (!sample) return null;
    return {
      timelapse: sample,
      donations: sampleDonations(slug),
      notes: sampleNotes(slug),
      upNext: SAMPLE_TIMELAPSES.filter((t) => t.slug !== slug).slice(0, 4),
      signedIn: false,
      demo: true,
    };
  }

  const [creator, donations, notes, feed] = await Promise.all([
    apiServer<PublicUser>(`/v1/creators/${live.creator.handle}`, 120),
    apiServer<Page<Donation>>(`/v1/timelapses/${slug}/donations`),
    apiServer<Page<Note>>(`/v1/timelapses/${slug}/notes`, 0),
    apiServer<Page<Timelapse>>("/v1/timelapses?limit=5"),
  ]);
  return {
    timelapse: live,
    payoutAddress: creator?.payoutAddress,
    donations: donations?.items ?? [],
    notes: notes?.items ?? [],
    upNext: (feed?.items ?? []).filter((t) => t.slug !== slug).slice(0, 4),
    signedIn: Boolean(viewer.user),
    demo: false,
  };
}

async function loadCreator(
  handle: string,
): Promise<Sourced<{ creator: PublicUser; items: Timelapse[] }> | null> {
  const [live, items, viewer] = await Promise.all([
    apiServer<PublicUser>(`/v1/creators/${handle}`),
    apiServer<Page<Timelapse>>(`/v1/creators/${handle}/timelapses`),
    getViewer(),
  ]);
  if (live) return { data: { creator: live, items: items?.items ?? [] }, demo: false };
  const sample = viewer.demo ? findSampleCreator(handle) : undefined;
  if (!sample) return null;
  return {
    data: { creator: sample, items: SAMPLE_TIMELAPSES.filter((t) => t.creator.handle === handle) },
    demo: true,
  };
}

export interface DashboardData {
  me: SelfUser;
  items: Timelapse[];
  donations: Donation[];
  demo: boolean;
}

export const getWatch = cache(loadWatch);
export const getCreator = cache(loadCreator);

export async function getDashboard(): Promise<DashboardData | "signin"> {
  const viewer = await getViewer();
  if (viewer.user) {
    const [mine, received] = await Promise.all([
      apiServer<Page<Timelapse>>("/v1/me/timelapses", 0),
      apiServer<Page<Donation>>("/v1/me/donations", 0),
    ]);
    return {
      me: viewer.user,
      items: mine?.items ?? [],
      donations: received?.items ?? [],
      demo: false,
    };
  }
  if (viewer.demo) {
    return { me: SAMPLE_SELF, items: SAMPLE_SUBMISSIONS, donations: SAMPLE_RECEIVED, demo: true };
  }
  return signInOrRetry(viewer);
}

export async function getAccount(): Promise<{ me: SelfUser; demo: boolean } | "signin"> {
  const viewer = await getViewer();
  if (viewer.user) return { me: viewer.user, demo: false };
  if (viewer.demo) return { me: SAMPLE_SELF, demo: true };
  return signInOrRetry(viewer);
}

export interface AdminData {
  operator: { displayName: string; handle: string };
  queue: Timelapse[];
  queueFailed: boolean;
  library: Timelapse[];
  audit: AuditEntry[];
  members: AdminMember[];
  ledger: LedgerEntry[];
  activity: ActivityDay[];
  notes: AdminNote[];
  stats: Stats;
}

export const getAdmin = cache(async (): Promise<AdminData | AdminAccess | "forbidden"> => {
  const viewer = await getViewer();

  if (viewer.user?.role === "admin" && viewer.adminAccess && viewer.adminAccess !== "ok") {
    return viewer.adminAccess;
  }
  if (viewer.user?.role === "admin") {
    // The console is the one surface that needs the whole set rather than a
    // page of it, so these walk the API's cursor to the end instead of asking
    // for one very large page — the server keeps its bound either way.
    const [queue, audit, library, members, ledger, activity, notes, stats] = await Promise.all([
      apiServerAllPages<Timelapse>("/v1/admin/queue?limit=100", 0),
      apiServerAllPages<AuditEntry>("/v1/admin/audit?limit=100", 0),
      apiServerAllPages<Timelapse>("/v1/timelapses?limit=50", 0),
      apiServerAllPages<AdminMember>("/v1/admin/members?limit=200", 0),
      apiServerAllPages<LedgerEntry>("/v1/admin/ledger?limit=200", 0),
      apiServer<Page<ActivityDay>>("/v1/admin/activity?days=30", 0),
      apiServer<Page<AdminNote>>("/v1/admin/notes?limit=200", 0),
      liveStats(),
    ]);
    return {
      operator: viewer.user,
      queue: queue?.items ?? [],
      queueFailed: queue === null,
      library: library?.items ?? [],
      audit: audit?.items ?? [],
      members: members?.items ?? [],
      ledger: ledger?.items ?? [],
      activity: activity?.items ?? [],
      notes: notes?.items ?? [],
      stats: stats ?? {
        creators: 0,
        publishedTimelapses: 0,
        sessionMinutesRecorded: 0,
        confirmedDonations: 0,
        donationTotalLamports: 0,
      },
    };
  }
  if (viewer.uncertain && !viewer.user) signInOrRetry(viewer);
  return "forbidden";
});
