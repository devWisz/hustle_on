import { FEED_PAGE_SIZE, getFeatured, getFeed, getStats, getViewer } from "@/lib/data";
import { SAMPLE_TIMELAPSES } from "@/lib/demo/content";
import type { Stats } from "@/lib/types";
import { EnterDemoButton } from "@/components/demo/demo";
import { DemoTag } from "@/components/demo/tag";
import { CountUp } from "@/components/motion/count-up";
import { Magnetic } from "@/components/motion/magnetic";
import { Marquee } from "@/components/motion/marquee";
import { ProgressRail } from "@/components/motion/progress-rail";
import { Reveal } from "@/components/motion/reveal";
import { ScrollScale } from "@/components/motion/scroll-scale";
import { SplitHeading } from "@/components/motion/split-heading";
import { parseSort } from "@/lib/feed";
import { Feed } from "@/components/timelapse/feed";
import { Showcase } from "@/components/timelapse/showcase";
import { ButtonLink, Container, SectionHeader } from "@/components/ui";
import { ArrowRightIcon, ShieldIcon, WalletIcon, ZapIcon } from "@/components/ui/icons";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sort = parseSort((await searchParams).sort);
  const [feed, stats, viewer, featured] = await Promise.all([
    getFeed(sort),
    getStats(),
    getViewer(),
    getFeatured(),
  ]);
  const featuredIds = new Set(featured.map((t) => t.id));
  const reel = [...featured, ...feed.data.filter((t) => !featuredIds.has(t.id))];
  const signedIn = Boolean(viewer.user);

  return (
    <>
      <Hero signedIn={signedIn} demo={viewer.demo} />

      <Container width="wide" className="-mt-2 sm:mt-0">
        <ScrollScale>
          <Showcase items={feed.demo ? [] : reel} fallback={SAMPLE_TIMELAPSES} demo={feed.demo} />
        </ScrollScale>
      </Container>

      <Claims />

      {stats ? <Figures stats={stats.data} demo={stats.demo} /> : null}

      <section id="feed" className="scroll-mt-20 pt-20 sm:pt-28" aria-labelledby="feed-heading">
        <Container width="wide">
          <Reveal>
            <SectionHeader
              eyebrow={feed.demo ? "The feed · demo library" : "The feed"}
              title={
                <span id="feed-heading">Real sessions, read by a person before they went up</span>
              }
              description="Filter by the kind of work, or sort by what people funded and watched most."
            />
          </Reveal>
          <div className="mt-10">
            <Feed
              items={feed.data}
              sort={sort}
              demo={feed.demo}
              nextCursor={feed.nextCursor}
              pageSize={FEED_PAGE_SIZE}
              emptyAction={<ButtonLink href="/upload">Upload the first one</ButtonLink>}
            />
          </div>
        </Container>
      </section>

      <HowItWorks />
      <Principles />
      <Closing signedIn={signedIn} demo={viewer.demo} />
    </>
  );
}

function Hero({ signedIn, demo }: { signedIn: boolean; demo: boolean }) {
  return (
    <section className="grid-backdrop">
      <Container width="wide" className="pb-12 pt-14 sm:pb-16 sm:pt-20 lg:pb-20 lg:pt-28">
        <Reveal immediate className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-fg-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
            Every session read by a person before it goes up
          </span>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <SplitHeading as="h1" onScroll={false} className="text-display lg:col-span-8">
            Your hustle should be paid off.
          </SplitHeading>

          <Reveal immediate delay={0.35} className="lg:col-span-4 lg:pb-3">
            <p className="text-lede text-fg-muted">
              Record the session. Write down what you actually did. People who watch it can sponsor
              you in SOL, wallet to wallet, or hire you for the next one.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Magnetic className="inline-flex w-full sm:w-auto">
                <ButtonLink href="/upload" size="lg" className="w-full sm:w-auto">
                  Upload a timelapse
                  <ArrowRightIcon size={16} className="nudge-icon" />
                </ButtonLink>
              </Magnetic>
              {signedIn || demo ? (
                <ButtonLink
                  href="/#feed"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Browse sessions
                </ButtonLink>
              ) : (
                <EnterDemoButton next="/" label="Explore the demo" className="w-full sm:w-auto" />
              )}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

const CLAIMS = [
  "0% platform cut",
  "Human review on every upload",
  "Wallet to wallet",
  "Rejections carry a reason",
  "Verified on-chain",
  "No passwords stored",
  "Your keys, always",
];

function Claims() {
  return (
    <div className="mt-16 border-y border-border py-6 sm:mt-24">
      <Marquee speed={45}>
        {CLAIMS.map((claim) => (
          <span
            key={claim}
            className="flex items-center gap-8 pr-8 text-[clamp(1.1rem,0.9rem+1vw,1.6rem)] font-medium tracking-tight text-fg-muted"
          >
            {claim}
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-border-strong" />
          </span>
        ))}
      </Marquee>
    </div>
  );
}

function Figures({ stats, demo }: { stats: Stats; demo: boolean }) {
  const figures = [
    {
      label: "Hours of work recorded",
      value: <CountUp value={Math.round(stats.sessionMinutesRecorded / 60)} format="plain" />,
    },
    {
      label: "Sessions published",
      value: <CountUp value={stats.publishedTimelapses} format="plain" />,
    },
    { label: "Creators", value: <CountUp value={stats.creators} format="plain" /> },
    {
      label: "Sent straight to creators",
      value: <CountUp value={stats.donationTotalLamports} format="sol" />,
    },
  ];

  return (
    <section aria-label="By the numbers" className="pt-20 sm:pt-28">
      <Container width="wide">
        <div className="flex items-center gap-3">
          <p className="text-eyebrow">By the numbers</p>
          {demo ? <DemoTag /> : null}
        </div>
        <Reveal
          as="dl"
          stagger={0.1}
          className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border lg:grid-cols-4"
        >
          {figures.map((f) => (
            <div key={f.label} className="bg-surface p-5 sm:p-8">
              <dd className="tnum text-[clamp(1.75rem,1.2rem+2.4vw,3.25rem)] font-semibold leading-none tracking-tight">
                {f.value}
              </dd>
              <dt className="mt-3 text-[13px] text-fg-muted">{f.label}</dt>
            </div>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

const STEPS = [
  {
    title: "Record yourself working",
    body: "Hit record when you sit down to work on something: a painting, a table, a jacket, an app, a launch. Film yourself, your desk or your screen.",
  },
  {
    title: "Turn it into a timelapse",
    body: "Speed the session up so hours of work fit into a minute or two. No editing expected. The clip is evidence, not a production.",
  },
  {
    title: "Upload it with a write-up",
    body: "Say what you set out to do, what went wrong and what you ended up with, and link the finished result so anyone can check.",
  },
  {
    title: "An admin approves it",
    body: "A reviewer compares the write-up with the recording before anything goes public. If it is sent back, you get a reason you can act on.",
  },
  {
    title: "People sponsor your hustle",
    body: "Signed-in viewers send SOL straight to your wallet, with no cut taken, or reach out to hire you for the next project.",
  },
];

function HowItWorks() {
  return (
    <section className="pt-24 sm:pt-36" aria-labelledby="how-heading">
      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <p className="text-eyebrow">How it works</p>
              <SplitHeading className="text-headline mt-4">
                From work session to sponsorship, in five steps.
              </SplitHeading>
              <Reveal delay={0.2}>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-muted">
                  Every session is read by a person before it goes public, so what people fund is
                  work that actually happened.
                </p>
                <ButtonLink href="/about" variant="secondary" className="mt-7">
                  Read the details
                  <ArrowRightIcon size={15} className="nudge-icon" />
                </ButtonLink>
              </Reveal>
            </div>
          </div>

          <ol className="relative lg:col-span-7">
            <ProgressRail className="bottom-6 left-[19px] top-6" />
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} className="relative flex gap-6 pb-12 last:pb-0">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg font-mono text-[13px] text-fg">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-[clamp(1.2rem,1rem+0.8vw,1.6rem)] font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-fg-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

const PRINCIPLES = [
  {
    icon: ShieldIcon,
    claim: "Nothing publishes itself",
    detail:
      "Publishing happens behind the admin role, and every decision is written to an append-only audit trail.",
  },
  {
    icon: ZapIcon,
    claim: "Rejections carry a reason",
    detail:
      "The API refuses a decline with no note, and so does the database. Creators read the reason on their dashboard.",
  },
  {
    icon: WalletIcon,
    claim: "Donations never touch us",
    detail:
      "SOL moves wallet to wallet. We hold no key, take no cut, and verify the transfer on-chain before crediting it.",
  },
];

function Principles() {
  return (
    <section className="pt-24 sm:pt-36" aria-labelledby="principles-heading">
      <Container width="wide">
        <Reveal>
          <SectionHeader
            eyebrow="What holds it together"
            title={
              <span id="principles-heading">Three promises, each with something enforcing it</span>
            }
          />
        </Reveal>
        <Reveal stagger={0.12} className="mt-12 grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <article
              key={p.claim}
              className="lift flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-8"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <p.icon size={19} />
              </span>
              <h3 className="mt-10 text-[19px] font-semibold tracking-tight">{p.claim}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-fg-muted">{p.detail}</p>
            </article>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

function Closing({ signedIn, demo }: { signedIn: boolean; demo: boolean }) {
  return (
    <section className="pt-24 sm:pt-36">
      <Container width="wide">
        <Reveal className="relative overflow-hidden rounded-[var(--radius-panel)] bg-inverse px-6 py-14 text-inverse-fg sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">Start here</p>
          <SplitHeading className="text-headline mt-5 max-w-3xl">
            Record it. Write it down. Get paid for it.
          </SplitHeading>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed opacity-70">
            Your first upload goes to review the same day. An account is one email and one click.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Magnetic className="inline-flex w-full sm:w-auto">
              <ButtonLink href="/upload" size="lg" variant="primary" className="w-full sm:w-auto">
                Start uploading
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink
              href={signedIn || demo ? "/dashboard" : "/login"}
              size="lg"
              variant="ghost"
              className="w-full text-inverse-fg/70 hover:bg-inverse-fg/10 hover:text-inverse-fg sm:w-auto"
            >
              {signedIn
                ? "Open your dashboard"
                : demo
                  ? "See the creator dashboard"
                  : "Create an account"}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
