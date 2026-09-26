import type { ActivityDay, AdminMember, AuditEntry, LedgerEntry, Timelapse } from "../types";
import { CREATORS, DEMO_SECONDS, SAMPLE_TIMELAPSES, ago, demoMedia, sol } from "./content";

const REVIEWER = { id: "s-admin", handle: "reviewer", displayName: "Rae Osei" };
const REVIEWER_2 = { id: "s-admin-2", handle: "jonas", displayName: "Jonas Berg" };

const NEWCOMERS = {
  lena: { id: "s-c7", handle: "lena", displayName: "Lena Fischer" },
  omar: { id: "s-c8", handle: "omar", displayName: "Omar Haddad" },
  sofia: { id: "s-c9", handle: "sofia", displayName: "Sofia Marin" },
  wei: { id: "s-c10", handle: "wei", displayName: "Wei Zhang" },
} as const;

export const DEMO_QUEUE: Timelapse[] = [
  {
    id: "s-q1",
    slug: "sample-queue-websocket-backpressure",
    ...demoMedia("payment-reconciler"),
    title: "Adding backpressure to the websocket fan-out",
    summary:
      "Slow clients were making the whole broadcast loop stall. This session adds a bounded buffer per connection and drops the slowest subscribers instead of blocking everyone else.\n\nThe load test at the end pushes 40k messages a second through it with two deliberately throttled clients. Both get disconnected with a reason; nobody else notices.",
    githubUrl: "https://github.com/example/realtime/pull/221",
    status: "in_review",
    durationSeconds: DEMO_SECONDS,
    sessionMinutes: 284,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: NEWCOMERS.lena,
    submittedAt: ago(52),
    createdAt: ago(70),
  },
  {
    id: "s-q2",
    slug: "sample-queue-shader-cache",
    ...demoMedia("firmware-bringup"),
    title: "A shader cache that survives driver updates",
    summary:
      "Our compiled shader cache was keyed on the source hash only, so a driver update served stale binaries and crashed on launch. The key now includes the driver version and the GPU id, and a corrupt entry is evicted instead of trusted.",
    githubUrl: "https://github.com/example/engine",
    xUrl: "https://x.com/example",
    status: "in_review",
    durationSeconds: DEMO_SECONDS,
    sessionMinutes: 197,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: NEWCOMERS.omar,
    submittedAt: ago(180),
    createdAt: ago(200),
  },
  {
    id: "s-q3",
    slug: "sample-queue-cleanup",
    ...demoMedia("typography-pass"),
    title: "Cleanup",
    summary: "Cleaned up some code and fixed things.",
    status: "in_review",
    durationSeconds: DEMO_SECONDS,
    sessionMinutes: 35,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: NEWCOMERS.sofia,
    submittedAt: ago(410),
    createdAt: ago(430),
  },
  {
    id: "s-q4",
    slug: "sample-queue-query-planner",
    ...demoMedia("index-hunt"),
    title: "Teaching the query planner about partial indexes",
    summary:
      "The planner ignored our partial index on unarchived rows because the predicate was written as NOT archived rather than archived = false. This session normalises boolean predicates before matching, with tests for the six spellings we found in the codebase.",
    githubUrl: "https://github.com/example/db/pull/77",
    status: "in_review",
    durationSeconds: DEMO_SECONDS,
    sessionMinutes: 356,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: NEWCOMERS.wei,
    submittedAt: ago(1260),
    createdAt: ago(1300),
  },
];

function member(
  creator: { id: string; handle: string; displayName: string },
  extra: Partial<AdminMember> & { joinedDaysAgo: number; activeMinutesAgo: number },
): AdminMember {
  const published = SAMPLE_TIMELAPSES.filter((t) => t.creator.handle === creator.handle);
  const inReview = DEMO_QUEUE.filter((t) => t.creator.handle === creator.handle).length;
  const { joinedDaysAgo, activeMinutesAgo, ...rest } = extra;
  return {
    ...creator,
    email: `${creator.handle}@example.com`,
    role: "member",
    status: "active",
    payoutVerified: published.length > 0,
    timelapseCount: published.length,
    donationCount: published.reduce((n, t) => n + t.donationCount, 0),
    donationTotalLamports: published.reduce((n, t) => n + t.donationTotalLamports, 0),
    inReview,
    rejected: 0,
    joinedAt: ago(joinedDaysAgo * 1440),
    lastActiveAt: ago(activeMinutesAgo),
    ...rest,
  };
}

export const DEMO_MEMBERS: AdminMember[] = [
  member(CREATORS.kenji, { joinedDaysAgo: 412, activeMinutesAgo: 35 }),
  member(CREATORS.theo, { joinedDaysAgo: 380, activeMinutesAgo: 140 }),
  member(CREATORS.mira, { joinedDaysAgo: 301, activeMinutesAgo: 20 }),
  member(CREATORS.dan, { joinedDaysAgo: 266, activeMinutesAgo: 2900 }),
  member(CREATORS.ana, { joinedDaysAgo: 190, activeMinutesAgo: 600 }),
  member(CREATORS.priya, { joinedDaysAgo: 122, activeMinutesAgo: 4100 }),
  member(NEWCOMERS.wei, { joinedDaysAgo: 30, activeMinutesAgo: 1300 }),
  member(NEWCOMERS.lena, { joinedDaysAgo: 12, activeMinutesAgo: 60, payoutVerified: true }),
  member(NEWCOMERS.omar, { joinedDaysAgo: 6, activeMinutesAgo: 190 }),
  member(NEWCOMERS.sofia, {
    joinedDaysAgo: 3,
    activeMinutesAgo: 420,
    rejected: 2,
    status: "suspended",
  }),
  member(REVIEWER, { joinedDaysAgo: 520, activeMinutesAgo: 4, role: "admin" }),
  member(REVIEWER_2, { joinedDaysAgo: 470, activeMinutesAgo: 900, role: "admin" }),
];

const DONORS = [
  { id: "s-d1", handle: "juno", displayName: "Juno Park" },
  { id: "s-d2", handle: "rafa", displayName: "Rafa Mendes" },
  { id: "s-d4", handle: "noor", displayName: "Noor Haddad" },
  { id: "s-d5", handle: "eli", displayName: "Eli Sandoval" },
];

const LEDGER_SHAPE: [number, number, number | null, LedgerEntry["status"], string?][] = [
  [0, 1.5, 0, "confirmed", "The dead ends were the most useful part."],
  [1, 0.5, 1, "confirmed", "Watched this twice before touching our own reconciler."],
  [4, 2.0, 2, "confirmed", "Morse-code debugging deserves funding on principle."],
  [2, 0.25, null, "confirmed"],
  [5, 1.0, 3, "submitted"],
  [3, 0.75, 0, "confirmed", "Keeping this for the next time a report page is slow."],
  [0, 0.1, null, "failed"],
  [1, 3.2, 2, "confirmed", "Our ledger had the exact same bug."],
  [4, 0.4, 1, "pending"],
  [2, 0.6, 3, "confirmed"],
  [5, 1.25, null, "confirmed", "Rollback first. Taking that to my team."],
  [3, 0.3, 0, "confirmed"],
];

export const DEMO_LEDGER: LedgerEntry[] = LEDGER_SHAPE.map(
  ([item, amount, donor, status, message], i) => {
    const t = SAMPLE_TIMELAPSES[item]!;
    const at = ago(25 + i * 173);
    return {
      id: `s-l${i + 1}`,
      amountLamports: sol(amount),
      message,
      status,
      signature:
        status === "pending"
          ? undefined
          : `${"5f3K9xQ2mNvR7tLwY8pHcB4dJ6sA1eUzG".slice(i % 5)}${i}XkP2`,
      donor: donor === null ? undefined : DONORS[donor],
      timelapse: { slug: t.slug, title: t.title },
      recipient: t.creator,
      confirmedAt: status === "confirmed" ? at : undefined,
      createdAt: at,
    };
  },
);

export const DEMO_ACTIVITY: ActivityDay[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  const wave = Math.sin(i / 3.2) * 2.4 + Math.cos(i / 1.7) * 1.3;
  const submitted = Math.max(1, Math.round(5 + wave + (i > 20 ? 2 : 0)));
  const rejected = Math.max(0, Math.round(submitted * 0.22 + Math.sin(i) * 0.8));
  const approved = Math.max(0, submitted - rejected - (i % 6 === 0 ? 1 : 0));
  const date = new Date(Date.now() - day * 86_400_000);
  date.setHours(0, 0, 0, 0);
  return {
    date: date.toISOString(),
    submitted,
    approved,
    rejected,
    lamports: sol(Math.max(0.2, 2.1 + wave * 0.8 + (i > 22 ? 1.5 : 0))),
  };
});

export const DEMO_AUDIT: AuditEntry[] = [
  {
    id: 9,
    action: "timelapse.approve",
    subjectType: "timelapse",
    subjectId: "s-1",
    actor: REVIEWER,
    metadata: { title: "Rewriting the borrow-checker pass" },
    createdAt: ago(97),
  },
  {
    id: 8,
    action: "timelapse.reject",
    subjectType: "timelapse",
    subjectId: "s-sub-3",
    actor: REVIEWER,
    metadata: {
      title: "Tidying the settings module",
      note: "The write-up does not say what changed or why, and there is no link to the result.",
    },
    createdAt: ago(260),
  },
  {
    id: 7,
    action: "timelapse.approve",
    subjectType: "timelapse",
    subjectId: "s-2",
    actor: REVIEWER_2,
    metadata: { title: "A payment reconciler that survives a double refund" },
    createdAt: ago(311),
  },
  {
    id: 6,
    action: "note.delete",
    subjectType: "note",
    subjectId: "s-n9",
    actor: REVIEWER_2,
    metadata: { note: "Removed an off-topic promotional link." },
    createdAt: ago(700),
  },
  {
    id: 5,
    action: "member.suspend",
    subjectType: "user",
    subjectId: "s-c9",
    actor: REVIEWER,
    metadata: { note: "Three low-effort submissions in one hour." },
    createdAt: ago(900),
  },
  {
    id: 4,
    action: "timelapse.approve",
    subjectType: "timelapse",
    subjectId: "s-3",
    actor: REVIEWER,
    metadata: { title: "Four hours finding one missing index" },
    createdAt: ago(1181),
  },
  {
    id: 3,
    action: "timelapse.takedown",
    subjectType: "timelapse",
    subjectId: "s-x1",
    actor: REVIEWER_2,
    metadata: { note: "Creator asked for it to be removed." },
    createdAt: ago(2200),
  },
  {
    id: 2,
    action: "timelapse.approve",
    subjectType: "timelapse",
    subjectId: "s-4",
    actor: REVIEWER_2,
    metadata: { title: "A typography pass on a dense settings screen" },
    createdAt: ago(2601),
  },
  {
    id: 1,
    action: "timelapse.approve",
    subjectType: "timelapse",
    subjectId: "s-5",
    actor: REVIEWER,
    metadata: { title: "Bringing up a board with no working UART" },
    createdAt: ago(4301),
  },
];

export const DEMO_ADMIN = { id: REVIEWER.id, handle: REVIEWER.handle, displayName: REVIEWER.displayName };
