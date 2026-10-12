import { FEED_PAGE_SIZE, getFeatured, getFeed, getViewer } from "@/lib/data";
import type { Timelapse } from "@/lib/types";
import { Magnetic } from "@/components/motion/magnetic";
import { ProgressRail } from "@/components/motion/progress-rail";
import { Reveal } from "@/components/motion/reveal";
import { ScrollScale } from "@/components/motion/scroll-scale";
import { SplitHeading } from "@/components/motion/split-heading";
import { parseSort } from "@/lib/feed";
import { SITE_TAGLINE } from "@/lib/brand";
import { Feed } from "@/components/timelapse/feed";
import { Showcase } from "@/components/timelapse/showcase";
import { ButtonLink, Container, SectionHeader } from "@/components/ui";
import { ArrowRightIcon, PlayIcon, ShieldIcon, WalletIcon, ZapIcon } from "@/components/ui/icons";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sort = parseSort((await searchParams).sort);
  const [feed, viewer, featured] = await Promise.all([
    getFeed(sort),
    getViewer(),
    getFeatured(),
  ]);
  const featuredIds = new Set(featured.map((t) => t.id));
  const reel = [...featured, ...feed.data.filter((t) => !featuredIds.has(t.id))];
  const signedIn = Boolean(viewer.user);

  return (
    <>
      <Hero />
      <Stage items={reel} />

      <Container width="wide" className="pt-12 sm:pt-16">
        <ProofBar />
      </Container>

        <section id="feed" className="scroll-mt-20 pt-20 sm:pt-28" aria-labelledby="feed-heading">
        <Container width="wide">
          <Reveal>
            <SectionHeader
              eyebrow="The feed"
              title={<span id="feed-heading">Work that actually happened</span>}
              description="Filter by the kind of work, or sort by what people funded and watched most."
            />
          </Reveal>
          <div className="mt-10">
            <Feed
              items={feed.data}
              sort={sort}
              nextCursor={feed.nextCursor}
              pageSize={FEED_PAGE_SIZE}
              emptyAction={<ButtonLink href="/upload">Upload the first one</ButtonLink>}
            />
          </div>
        </Container>
      </section>

      <HowItWorks />
      <Principles />
      <Closing signedIn={signedIn} />
    </>
  );
}

const PROOF = [
  { icon: ShieldIcon, label: "Reviewed by a person" },
  { icon: ZapIcon, label: "A reason if it is sent back" },
  { icon: WalletIcon, label: "SOL goes wallet to wallet" },
];

/**
 * One centred statement, one line of pitch, two buttons — and then the product
 * itself in the next section. The statement is the only thing competing for
 * attention, which is the whole trick of the reference: an earlier version put
 * the heading in eight columns beside the pitch and left a hole where the
 * heading ran out.
 */
function Hero() {
  return (
    <section className="grid-backdrop">
      <Container width="wide" className="pt-16 text-center sm:pt-20 lg:pt-24">
        <SplitHeading as="h1" onScroll={false} className="text-hero mx-auto max-w-5xl">
          {SITE_TAGLINE}
        </SplitHeading>

        <Reveal immediate delay={0.4}>
          <p className="text-lede mx-auto mt-8 max-w-2xl text-fg-muted">
            Record the session. Say what you did. Viewers send SOL straight to your wallet, or
            reach out to hire you for the next one.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Magnetic className="inline-flex w-full sm:w-auto">
              <ButtonLink href="/upload" size="lg" className="w-full sm:w-auto">
                Upload a timelapse
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink
              href="/#feed"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Browse as a guest
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/** The three promises, as a thin strip under the product panel. */
function ProofBar() {
  return (
    <Reveal className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">
      {PROOF.map((p) => (
        <div key={p.label} className="flex items-center gap-3 bg-surface px-5 py-4">
          <p.icon size={16} className="shrink-0 text-accent" />
          <span className="text-[13.5px] font-medium tracking-tight">{p.label}</span>
        </div>
      ))}
    </Reveal>
  );
}

/**
 * The product shot, sitting directly under the hero so the fold cuts it — the
 * composition the reference uses. With nothing published yet the reel would
 * render nothing at all and the whole first screen would go blank, so the empty
 * state holds the identical frame and aspect instead.
 */
function Stage({ items }: { items: Timelapse[] }) {
  const hasReel = items.some((t) => t.playbackUrl);
  return (
    <section className="pt-14 sm:pt-20">
      <Container width="wide">
        <div className="relative isolate">
          {hasReel ? (
            <ScrollScale>
              <Showcase items={items} />
            </ScrollScale>
          ) : (
            <StageEmpty />
          )}
        </div>
      </Container>
    </section>
  );
}

function StageEmpty() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-lifted)]">
      <div className="grid-backdrop flex h-[380px] flex-col items-center justify-center gap-6 px-6 text-center sm:h-[460px]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-bg text-fg-muted">
          <PlayIcon size={20} />
        </span>
        <p className="max-w-md text-[15px] leading-relaxed text-fg-muted">
          Nothing has been published yet. Every session is read before it goes up, so the first
          ones are being reviewed right now.
        </p>
        <ButtonLink href="/upload">Upload the first one</ButtonLink>
      </div>
    </div>
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
                  A session is reviewed before it goes public, and if it is sent back you get a
                  reason you can act on. What people fund is work that actually happened.
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
    claim: "Sent back with a reason",
    detail:
      "If your session is not accepted, you get a specific reason and can fix it and resend it.",
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

function Closing({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="pt-24 sm:pt-36">
      <Container width="wide">
        <Reveal className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface px-6 py-14 text-fg shadow-[var(--shadow-raised)] sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">Start here</p>
          <SplitHeading className="text-headline mt-5 max-w-3xl">
            Record it. Write it down. Get paid for it.
          </SplitHeading>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-fg-muted">
            Your first upload goes to review the same day. An account is one wallet signature.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Magnetic className="inline-flex w-full sm:w-auto">
              <ButtonLink href="/upload" size="lg" variant="primary" className="w-full sm:w-auto">
                Start uploading
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink
              href={signedIn ? "/dashboard" : "/login"}
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto"
            >
              {signedIn ? "Open your dashboard" : "Create an account"}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
