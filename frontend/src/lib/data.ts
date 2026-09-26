import "server-only";
import { cache } from "react";
import { apiServer } from "./api/server";
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
import {
  DEMO_ACTIVITY,
  DEMO_ADMIN,
  DEMO_AUDIT,
  DEMO_LEDGER,
  DEMO_MEMBERS,
  DEMO_QUEUE,
} from "./demo/admin";
import type {
  ActivityDay,
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
  online: boolean;
  demo: boolean;
}

const liveStats = cache(() => apiServer<Stats>("/v1/stats", 60));

export const getViewer = cache(async (): Promise<Viewer> => {
  const [stats, session, cookie] = await Promise.all([
    liveStats(),
    apiServer<SessionResponse>("/v1/auth/session", 0),
    hasDemoCookie(),
  ]);
  const online = stats !== null;
  const user = session?.authenticated ? session.user : undefined;
  return { user, online, demo: !user && (cookie || !online) };
});

export interface Sourced<T> {
  data: T;
  demo: boolean;
}

export async function getStats(): Promise<Sourced<Stats> | null> {
  const [stats, viewer] = await Promise.all([liveStats(), getViewer()]);
  if (stats && stats.publishedTimelapses > 0) return { data: stats, demo: false };
  return viewer.demo ? { data: SAMPLE_STATS, demo: true } : null;
}

export async function getFeed(sort: string): Promise<Sourced<Timelapse[]>> {
  const query = sort ? `?limit=24&sort=${sort}` : "?limit=24";
  const [page, viewer] = await Promise.all([
    apiServer<Page<Timelapse>>(`/v1/timelapses${query}`),
    getViewer(),
  ]);
  const live = page?.items ?? [];
  if (live.length === 0 && viewer.demo) return { data: sampleFeed(sort), demo: true };
  return { data: live, demo: false };
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

export async function getWatch(slug: string): Promise<WatchData | null> {
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

export async function getCreator(
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
  return "signin";
}

export async function getAccount(): Promise<{ me: SelfUser; demo: boolean } | "signin"> {
  const viewer = await getViewer();
  if (viewer.user) return { me: viewer.user, demo: false };
  if (viewer.demo) return { me: SAMPLE_SELF, demo: true };
  return "signin";
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
  stats: Stats;
  demo: boolean;
}

export const getAdmin = cache(async (): Promise<AdminData | "signin" | "forbidden"> => {
  const viewer = await getViewer();

  if (viewer.user?.role === "admin") {
    const [queue, audit, library, stats] = await Promise.all([
      apiServer<Page<Timelapse>>("/v1/admin/queue", 0),
      apiServer<Page<AuditEntry>>("/v1/admin/audit?limit=100", 0),
      apiServer<Page<Timelapse>>("/v1/timelapses?limit=100", 0),
      liveStats(),
    ]);
    return {
      operator: viewer.user,
      queue: queue?.items ?? [],
      queueFailed: queue === null,
      library: library?.items ?? [],
      audit: audit?.items ?? [],
      members: [],
      ledger: [],
      activity: [],
      stats: stats ?? SAMPLE_STATS,
      demo: false,
    };
  }
  if (viewer.user) return "forbidden";
  if (!viewer.demo) return "signin";

  return {
    operator: DEMO_ADMIN,
    queue: DEMO_QUEUE,
    queueFailed: false,
    library: SAMPLE_TIMELAPSES,
    audit: DEMO_AUDIT,
    members: DEMO_MEMBERS,
    ledger: DEMO_LEDGER,
    activity: DEMO_ACTIVITY,
    stats: SAMPLE_STATS,
    demo: true,
  };
});
