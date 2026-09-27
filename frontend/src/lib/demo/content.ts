import type { Donation, Note, PublicUser, SelfUser, Stats, Timelapse } from "../types";
import { LAMPORTS_PER_SOL } from "../format";

const SAMPLE_PREFIX = "sample-";

export function isSampleSlug(slug: string): boolean {
  return slug.startsWith(SAMPLE_PREFIX);
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function sol(amount: number): number {
  return Math.round(amount * LAMPORTS_PER_SOL);
}

const CLIPS = {
  painting: { file: "painting-studio", seconds: 12 },
  wood: { file: "wood-workshop", seconds: 15 },
  sewing: { file: "sewing-studio", seconds: 16 },
  code: { file: "late-night-code", seconds: 14 },
  office: { file: "office-sprint", seconds: 9 },
  desk: { file: "writing-desk", seconds: 12 },
} as const;

function clip(name: keyof typeof CLIPS): Pick<Timelapse, "playbackUrl" | "thumbnailUrl" | "durationSeconds"> {
  const c = CLIPS[name];
  return {
    playbackUrl: `/demo/${c.file}.mp4`,
    thumbnailUrl: `/demo/${c.file}.jpg`,
    durationSeconds: c.seconds,
  };
}

const CREATORS = {
  ana: { id: "s-c1", handle: "ana", displayName: "Ana Ruiz" },
  kenji: { id: "s-c2", handle: "kenji", displayName: "Kenji Watanabe" },
  priya: { id: "s-c3", handle: "priya", displayName: "Priya Raman" },
  theo: { id: "s-c4", handle: "theo", displayName: "Theo Lindqvist" },
  dan: { id: "s-c5", handle: "dan", displayName: "Dan Whitfield" },
  mira: { id: "s-c6", handle: "mira", displayName: "Mira Okonkwo" },
} as const;

const SAMPLE_BIOS: Record<string, string> = {
  ana: "Painter. I record whole commissions, from the first wash to the last signature.",
  kenji: "Furniture maker working out of a small shared workshop. Hardwoods, hand tools, one table at a time.",
  priya: "Pattern cutter and seamstress building a small clothing label, one prototype at a time.",
  theo: "Software engineer who does his best work after midnight. Mostly data tools and dashboards.",
  dan: "Co-founder of a four-person startup. I film launch days so the team can see how the day actually went.",
  mira: "Freelance designer and developer. Portfolios, landing pages and the small sites nobody else wants to build.",
};

export const SAMPLE_TIMELAPSES: Timelapse[] = [
  {
    id: "s-1",
    slug: "sample-portrait-commission",
    ...clip("painting"),
    title: "Finishing a portrait commission in one sitting",
    summary:
      "A client asked for a large abstract portrait for their studio. This session is the final six hours: blocking the colour fields, building up the face in layers, and fixing the left side twice after it read as flat from across the room.\n\nThe timelapse shows every false start. The finished piece shipped the next morning.",
    status: "published",
    sessionMinutes: 372,
    viewCount: 4820,
    donationCount: 14,
    donationTotalLamports: sol(6.42),
    creator: CREATORS.ana,
    publishedAt: ago(96),
    createdAt: ago(150),
  },
  {
    id: "s-2",
    slug: "sample-walnut-side-table",
    ...clip("wood"),
    title: "Building a walnut side table from rough boards",
    summary:
      "Started with two rough-sawn walnut boards and ended with a finished side table. Most of the session is milling: flattening, jointing and planing until the boards were square, then cutting the joinery by hand.\n\nOne leg came out a millimetre short and I had to recut all four to match. It is in the recording.",
    status: "published",
    sessionMinutes: 488,
    viewCount: 9310,
    donationCount: 31,
    donationTotalLamports: sol(12.8),
    creator: CREATORS.kenji,
    publishedAt: ago(310),
    createdAt: ago(400),
  },
  {
    id: "s-3",
    slug: "sample-jacket-prototype",
    ...clip("sewing"),
    title: "Sewing the first prototype of a lined jacket",
    summary:
      "The first physical sample for my label's autumn jacket. The session covers cutting the shell and lining, setting the sleeves, and a long stretch redoing the collar after it twisted on the first attempt.\n\nThe pattern is on my site for anyone who wants to follow along.",
    status: "published",
    sessionMinutes: 247,
    viewCount: 6140,
    donationCount: 22,
    donationTotalLamports: sol(4.15),
    creator: CREATORS.priya,
    publishedAt: ago(1180),
    createdAt: ago(1300),
  },
  {
    id: "s-4",
    slug: "sample-late-night-dashboard",
    ...clip("code"),
    title: "A late-night push on a live trading dashboard",
    summary:
      "The dashboard was lagging seconds behind the market feed. This session moves the chart updates off the main thread and batches them, then load-tests it against a replay of a busy morning.\n\nThe lag went from four seconds to under a hundred milliseconds. The pull request is linked.",
    githubUrl: "https://github.com/example/dashboard",
    status: "published",
    sessionMinutes: 331,
    viewCount: 3270,
    donationCount: 9,
    donationTotalLamports: sol(2.05),
    creator: CREATORS.theo,
    publishedAt: ago(2600),
    createdAt: ago(2700),
  },
  {
    id: "s-5",
    slug: "sample-launch-day",
    ...clip("office"),
    title: "Launch day with a four-person team",
    summary:
      "We launched the public beta of our booking app. The recording covers the whole working day in the office: final bug fixes in the morning, the release at noon, and the afternoon answering the first wave of support messages.\n\nThe write-up lists what broke and what we changed the next day.",
    xUrl: "https://x.com/example",
    status: "published",
    sessionMinutes: 615,
    viewCount: 11240,
    donationCount: 47,
    donationTotalLamports: sol(19.6),
    creator: CREATORS.dan,
    publishedAt: ago(4300),
    createdAt: ago(4500),
  },
  {
    id: "s-6",
    slug: "sample-portfolio-rebuild",
    ...clip("desk"),
    title: "Rebuilding my portfolio site in an afternoon",
    summary:
      "My old portfolio took eight seconds to load on a phone. This session rebuilds it from scratch: a simpler layout, compressed images, and a contact form that actually sends.\n\nThe new site loads in under a second and I have linked the before and after.",
    githubUrl: "https://github.com/example/portfolio",
    status: "published",
    sessionMinutes: 402,
    viewCount: 5480,
    donationCount: 18,
    donationTotalLamports: sol(7.3),
    creator: CREATORS.mira,
    publishedAt: ago(7200),
    createdAt: ago(7400),
  },
];

export const SAMPLE_STATS: Stats = {
  creators: 6,
  publishedTimelapses: SAMPLE_TIMELAPSES.length,
  sessionMinutesRecorded: SAMPLE_TIMELAPSES.reduce((total, t) => total + t.sessionMinutes, 0),
  confirmedDonations: SAMPLE_TIMELAPSES.reduce((total, t) => total + t.donationCount, 0),
  donationTotalLamports: SAMPLE_TIMELAPSES.reduce((total, t) => total + t.donationTotalLamports, 0),
};

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

export function sampleNotes(slug: string): Note[] {
  const timelapse = findSampleTimelapse(slug);
  if (!timelapse) return [];
  return [
    {
      id: `${timelapse.id}-n1`,
      body: "The part around the middle is worth watching twice. Seeing where you stopped, stepped back and changed approach taught me more than the finished result.",
      timestampSeconds: 6,
      helpfulCount: 14,
      viewerHasVoted: false,
      viewerCanDelete: false,
      author: { id: "s-n1", handle: "arivers", displayName: "Alex Rivers" },
      createdAt: ago(80),
    },
    {
      id: `${timelapse.id}-n2`,
      body: "Good call redoing that step instead of hiding it. I would have kept going and regretted it later.",
      timestampSeconds: 3,
      helpfulCount: 9,
      viewerHasVoted: false,
      viewerCanDelete: false,
      author: { id: "s-n2", handle: "elena", displayName: "Elena Rostova" },
      createdAt: ago(240),
    },
    {
      id: `${timelapse.id}-n3`,
      body: "Leaving the mistakes in is what makes these worth watching. Please keep doing that.",
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
      message: "Watched this twice before starting my own project.",
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

const SELF = { id: "s-me", handle: "alex", displayName: "Alex Morgan" };

export const SAMPLE_SELF: SelfUser = {
  ...SELF,
  email: "alex@example.com",
  emailVerified: true,
  role: "member",
  bio: "",
  payoutVerified: false,
  timelapseCount: 1,
  donationCount: 9,
  donationTotalLamports: sol(3.1),
  joinedAt: ago(60 * 24 * 96),
};

export const SAMPLE_SUBMISSIONS: Timelapse[] = [
  {
    id: "s-sub-1",
    slug: "sample-your-bookshelf",
    ...clip("wood"),
    title: "Building a bookshelf for the studio",
    summary: "Six hours of cutting, sanding and fitting shelves, plus the two that came out crooked.",
    status: "published",
    sessionMinutes: 372,
    viewCount: 2140,
    donationCount: 7,
    donationTotalLamports: sol(2.4),
    creator: SELF,
    publishedAt: ago(1500),
    submittedAt: ago(1700),
    createdAt: ago(1720),
  },
  {
    id: "s-sub-2",
    slug: "sample-your-poster-series",
    ...clip("painting"),
    title: "Painting a series of three gig posters",
    summary: "Sketch to final colour for three posters for a local venue, done in one long session.",
    status: "in_review",
    sessionMinutes: 164,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: SELF,
    submittedAt: ago(180),
    createdAt: ago(210),
  },
  {
    id: "s-sub-3",
    slug: "sample-your-work-session",
    ...clip("desk"),
    title: "Work session",
    summary: "Worked on some stuff for a few hours.",
    status: "rejected",
    reviewNote:
      "The write-up does not say what you worked on or what came out of it. Tell viewers what you set out to do, what you finished, and link the result if it is online, then send it back. The recording itself is fine.",
    sessionMinutes: 48,
    viewCount: 0,
    donationCount: 0,
    donationTotalLamports: 0,
    creator: SELF,
    submittedAt: ago(2600),
    createdAt: ago(2700),
  },
];

export const SAMPLE_RECEIVED: Donation[] = [
  {
    id: "s-r1",
    amountLamports: sol(1.2),
    message: "The joinery section saved me a weekend.",
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
