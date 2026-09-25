import type { Donation, Note, PublicUser, SelfUser, Stats, Timelapse } from "./types";
import { LAMPORTS_PER_SOL } from "./format";

/**
 * The sample library shown in guest preview.
 *
 * Every record here is invented. It exists so somebody who has not signed in
 * can see what a populated feed, a watch page and a dashboard actually look
 * like, rather than judging the product by an empty grid.
 *
 * Two rules keep that honest. Nothing in this file is ever rendered without
 * the surface saying it is a sample — the cards carry a badge, the pages carry
 * a banner — and none of it is used on a signed-in session or on a page whose
 * live data loaded. Sample slugs are all prefixed `sample-`, so a preview link
 * can never collide with a real one.
 */

const SAMPLE_PREFIX = "sample-";

export function isSampleSlug(slug: string): boolean {
  return slug.startsWith(SAMPLE_PREFIX);
}

/** ISO timestamp for a point in the past, so relative times read naturally. */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function sol(amount: number): number {
  return Math.round(amount * LAMPORTS_PER_SOL);
}

const CREATORS = {
  mira: { id: "s-c1", handle: "mira", displayName: "Mira Okonkwo" },
  theo: { id: "s-c2", handle: "theo", displayName: "Theo Lindqvist" },
  ana: { id: "s-c3", handle: "ana", displayName: "Ana Ruiz" },
  kenji: { id: "s-c4", handle: "kenji", displayName: "Kenji Watanabe" },
  priya: { id: "s-c5", handle: "priya", displayName: "Priya Raman" },
  dan: { id: "s-c6", handle: "dan", displayName: "Dan Whitfield" },
} as const;

export const SAMPLE_TIMELAPSES: Timelapse[] = [
  {
    id: "s-1",
    slug: "sample-borrow-checker-pass",
    title: "Rewriting the borrow-checker pass",
    summary:
      "Spent the session replacing the recursive walk in our lifetime inference with an explicit worklist. The recursion was blowing the stack on generated code — one file in the test corpus nests closures fourteen deep and it died every time.\n\nThe worklist version is uglier to read and about four times faster, which was not the point but I will take it. Two tests still fail on early-return borrows; I left them failing rather than papering over them, and the commit says so.",
    githubUrl: "https://github.com/example/lang/pull/812",
    status: "published",
    durationSeconds: 214,
    sessionMinutes: 331,
    viewCount: 4820,
    donationCount: 14,
    donationTotalLamports: sol(6.42),
    creator: CREATORS.mira,
    publishedAt: ago(96),
    createdAt: ago(150),
  },
  {
    id: "s-2",
    slug: "sample-payment-reconciler",
    title: "A payment reconciler that survives a double refund",
    summary:
      "Our reconciler assumed a refund could only happen once per charge. It cannot. A support agent and a webhook retry did it simultaneously last Tuesday and the ledger went negative.\n\nThis session is the rewrite: every mutation now carries an idempotency key derived from the provider's event id, and the ledger is append-only with a computed balance instead of a stored one. The interesting bit starts around the eleven-minute mark, where I reproduce the original bug on purpose before fixing it.",
    githubUrl: "https://github.com/example/ledger",
    xUrl: "https://x.com/example",
    status: "published",
    durationSeconds: 402,
    sessionMinutes: 488,
    viewCount: 9310,
    donationCount: 31,
    donationTotalLamports: sol(12.8),
    creator: CREATORS.theo,
    publishedAt: ago(310),
    createdAt: ago(400),
  },
  {
    id: "s-3",
    slug: "sample-sqlite-index-hunt",
    title: "Four hours finding one missing index",
    summary:
      "A report page took nine seconds to load and nobody could say why. The session is mostly reading query plans and being wrong.\n\nIt turned out to be a correlated subquery in a view, three levels down, that nobody had opened since 2022. The fix is one index and two deleted lines. I kept the dead ends in the recording because the dead ends were the work.",
    githubUrl: "https://github.com/example/reports",
    status: "published",
    durationSeconds: 168,
    sessionMinutes: 247,
    viewCount: 6140,
    donationCount: 22,
    donationTotalLamports: sol(4.15),
    creator: CREATORS.ana,
    publishedAt: ago(1180),
    createdAt: ago(1300),
  },
  {
    id: "s-4",
    slug: "sample-typography-pass",
    title: "A typography pass on a dense settings screen",
    summary:
      "No new features. The settings screen had eleven type sizes on it and read like a form someone had lost an argument with.\n\nThis session cuts it to four, sets everything on a four-point rhythm, and moves the destructive actions into their own group at the bottom. Half of the recording is me undoing changes that looked better in isolation and worse in the page.",
    xUrl: "https://x.com/example",
    status: "published",
    durationSeconds: 289,
    sessionMinutes: 196,
    viewCount: 3270,
    donationCount: 9,
    donationTotalLamports: sol(2.05),
    creator: CREATORS.priya,
    publishedAt: ago(2600),
    createdAt: ago(2700),
  },
  {
    id: "s-5",
    slug: "sample-firmware-bringup",
    title: "Bringing up a board with no working UART",
    summary:
      "The debug serial line was dead, so the entire session is done by blinking one LED in morse. It is as slow as it sounds.\n\nBy the end the clock tree is configured, the bootloader hands off correctly, and the UART turns out to have been fine all along — the pin was muxed to the wrong peripheral in a header nobody had regenerated. The last twenty minutes are just relief.",
    githubUrl: "https://github.com/example/board-bringup",
    status: "published",
    durationSeconds: 331,
    sessionMinutes: 615,
    viewCount: 11240,
    donationCount: 47,
    donationTotalLamports: sol(19.6),
    creator: CREATORS.kenji,
    publishedAt: ago(4300),
    createdAt: ago(4500),
  },
  {
    id: "s-6",
    slug: "sample-migration-rollback",
    title: "Writing the rollback before the migration",
    summary:
      "We are splitting a table that forty services read from. The session is spent writing the down-migration first and proving it on a branch of production data, because the only migration worth trusting is the one you have already reversed once.\n\nThe forward migration takes six minutes. The rollback takes nine. Both are in the repository, both are tested, and neither has been run in anger yet.",
    githubUrl: "https://github.com/example/platform",
    status: "published",
    durationSeconds: 246,
    sessionMinutes: 402,
    viewCount: 5480,
    donationCount: 18,
    donationTotalLamports: sol(7.3),
    creator: CREATORS.dan,
    publishedAt: ago(7200),
    createdAt: ago(7400),
  },
];

export const SAMPLE_STATS: Stats = {
  creators: 6,
  publishedTimelapses: SAMPLE_TIMELAPSES.length,
  sessionMinutesRecorded: SAMPLE_TIMELAPSES.reduce((total, t) => total + t.sessionMinutes, 0),
  confirmedDonations: SAMPLE_TIMELAPSES.reduce((total, t) => total + t.donationCount, 0),
  donationTotalLamports: SAMPLE_TIMELAPSES.reduce(
    (total, t) => total + t.donationTotalLamports,
    0,
  ),
};

/** The feed, ordered the way the API would order it for each tab. */
export function sampleFeed(sort: string): Timelapse[] {
  const items = [...SAMPLE_TIMELAPSES];
  switch (sort) {
    case "funded":
      return items.sort((a, b) => b.donationTotalLamports - a.donationTotalLamports);
    case "watched":
      return items.sort((a, b) => b.viewCount - a.viewCount);
    case "longest":
      return items.sort((a, b) => b.sessionMinutes - a.sessionMinutes);
    default:
      return items.sort(
        (a, b) => Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt),
      );
  }
}

export function findSampleTimelapse(slug: string): Timelapse | undefined {
  return SAMPLE_TIMELAPSES.find((t) => t.slug === slug);
}

export function findSampleCreator(handle: string): PublicUser | undefined {
  const published = SAMPLE_TIMELAPSES.filter((t) => t.creator.handle === handle);
  const first = published[0];
  if (!first) return undefined;
  return {
    ...first.creator,
    bio: SAMPLE_BIOS[handle],
    timelapseCount: published.length,
    donationCount: published.reduce((total, t) => total + t.donationCount, 0),
    donationTotalLamports: published.reduce((total, t) => total + t.donationTotalLamports, 0),
    joinedAt: ago(60 * 24 * 420),
  };
}

const SAMPLE_BIOS: Record<string, string> = {
  mira: "Compiler internals, mostly lifetimes. I record the sessions where I am wrong for longer than I am right.",
  theo: "Payments infrastructure. Ledgers that balance, or an explanation of why they did not.",
  ana: "Databases and the queries people regret. Four hours of query plans, condensed.",
  kenji: "Firmware and board bring-up. Everything here was recorded at a bench.",
  priya: "Interface work on products that are already shipped and already dense.",
  dan: "Platform migrations, written down so the next person does not have to guess.",
};

/**
 * Sample peer notes for a previewed timelapse.
 *
 * A thread is the most believable part of a watch page, so leaving it empty in
 * a preview would undersell the page — but an invented observation attributed
 * to a name is exactly the kind of unlabelled fake data the product refuses to
 * show. The panel renders these behind a sample badge and disables everything
 * that would write, so they can only ever be read as illustration.
 */
export function sampleNotes(slug: string): Note[] {
  const timelapse = findSampleTimelapse(slug);
  if (!timelapse) return [];
  return [
    {
      id: `${timelapse.id}-n1`,
      body: "The part around the middle is worth watching twice — the fixpoint is computed over the dominator tree rather than the CFG, which is why the nested case stops miscompiling.",
      timestampSeconds: 38,
      helpfulCount: 14,
      viewerHasVoted: false,
      viewerCanDelete: false,
      author: { id: "s-n1", handle: "arivers", displayName: "Alex Rivers" },
      createdAt: ago(80),
    },
    {
      id: `${timelapse.id}-n2`,
      body: "Notice how the region inference pass was walking the graph twice before this change. That redundant traversal is the actual bug, and the rewrite is what removes it.",
      timestampSeconds: 15,
      helpfulCount: 9,
      viewerHasVoted: false,
      viewerCanDelete: false,
      author: { id: "s-n2", handle: "elena_dev", displayName: "Elena Rostova" },
      createdAt: ago(240),
    },
    {
      id: `${timelapse.id}-n3`,
      body: "Leaving the two failing tests in rather than skipping them is the right call, and the commit message saying so is better than a green suite that lies.",
      helpfulCount: 6,
      viewerHasVoted: false,
      viewerCanDelete: false,
      author: { id: "s-n3", handle: "mchen", displayName: "Marcus Chen" },
      createdAt: ago(610),
    },
  ];
}

export function sampleDonations(slug: string): Donation[] {
  const timelapse = findSampleTimelapse(slug);
  if (!timelapse) return [];
  return [
    {
      id: `${timelapse.id}-d1`,
      amountLamports: sol(1.5),
      message: "The dead ends were the most useful part. Please keep leaving them in.",
      status: "confirmed",
      donor: { id: "s-d1", handle: "juno", displayName: "Juno Park" },
      confirmedAt: ago(41),
      createdAt: ago(42),
    },
    {
      id: `${timelapse.id}-d2`,
      amountLamports: sol(0.5),
      message: "Watched this twice before touching our own reconciler.",
      status: "confirmed",
      donor: { id: "s-d2", handle: "rafa", displayName: "Rafa Mendes" },
      confirmedAt: ago(190),
      createdAt: ago(191),
    },
    {
      id: `${timelapse.id}-d3`,
      amountLamports: sol(0.25),
      status: "confirmed",
      confirmedAt: ago(620),
      createdAt: ago(621),
    },
  ];
}

/**
 * The account a guest is shown on the dashboard and settings screens.
 *
 * It deliberately includes an unverified payout wallet and one rejected
 * submission, because those are the two states the product is actually about:
 * a decision came back, and it came back with a reason.
 */
export const SAMPLE_SELF: SelfUser = {
  id: "s-me",
  handle: "you",
  displayName: "Your name",
  email: "you@example.com",
  emailVerified: true,
  role: "member",
  bio: "",
  payoutVerified: false,
  timelapseCount: 2,
  donationCount: 9,
  donationTotalLamports: sol(3.1),
  joinedAt: ago(60 * 24 * 96),
};

export const SAMPLE_SUBMISSIONS: Timelapse[] = [
  {
    id: "s-sub-1",
    slug: "sample-your-parser-session",
    title: "Replacing the hand-written parser with a generated one",
    summary: "Six hours of grammar wrangling, plus the two tests it broke.",
    status: "published",
    durationSeconds: 198,
    sessionMinutes: 372,
    viewCount: 2140,
    donationCount: 7,
    donationTotalLamports: sol(2.4),
    creator: { id: "s-me", handle: "you", displayName: "Your name" },
    publishedAt: ago(1500),
    submittedAt: ago(1700),
    createdAt: ago(1720),
  },
  {
    id: "s-sub-2",
    slug: "sample-your-cache-session",
    title: "Caching the expensive route",
    summary: "Added a read-through cache and the invalidation that goes with it.",
    status: "in_review",
    durationSeconds: 142,
    sessionMinutes: 164,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: { id: "s-me", handle: "you", displayName: "Your name" },
    submittedAt: ago(180),
    createdAt: ago(210),
  },
  {
    id: "s-sub-3",
    slug: "sample-your-refactor-session",
    title: "Tidying the settings module",
    summary: "Moved some files around.",
    status: "rejected",
    reviewNote:
      "The write-up does not say what changed or why, and there is no link to the result. Tell us what the module looked like before, what you moved and what that fixed, then send it back — the recording itself is fine.",
    durationSeconds: 96,
    sessionMinutes: 48,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: { id: "s-me", handle: "you", displayName: "Your name" },
    submittedAt: ago(2600),
    createdAt: ago(2700),
  },
];

export const SAMPLE_RECEIVED: Donation[] = [
  {
    id: "s-r1",
    amountLamports: sol(1.2),
    message: "The invalidation section saved me a day.",
    status: "confirmed",
    donor: { id: "s-d4", handle: "noor", displayName: "Noor Haddad" },
    confirmedAt: ago(300),
    createdAt: ago(301),
  },
  {
    id: "s-r2",
    amountLamports: sol(0.75),
    status: "confirmed",
    confirmedAt: ago(1400),
    createdAt: ago(1401),
  },
  {
    id: "s-r3",
    amountLamports: sol(0.4),
    message: "More of these please.",
    status: "confirmed",
    donor: { id: "s-d5", handle: "eli", displayName: "Eli Sandoval" },
    confirmedAt: ago(3900),
    createdAt: ago(3901),
  },
];
