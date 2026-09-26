import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Page, SessionResponse, Stats, Timelapse } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { SAMPLE_STATS, SAMPLE_TIMELAPSES, sampleFeed } from "@/lib/sample";
import { formatCount } from "@/lib/format";
import { TimelapseGrid } from "@/components/timelapse-card";
import { ButtonLink, Container, EmptyState } from "@/components/ui";
import { EnterGuestButton, SampleTag } from "@/components/guest";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { FeedTabs, parseSort, type FeedSort } from "@/components/feed-tabs";
import { HeroShowcase } from "@/components/hero-showcase";
import { ApiStatus } from "@/components/api-status";
import {
  ArrowRightIcon,
  ShieldIcon,
  TrendingIcon,
  UploadIcon,
  WalletIcon,
} from "@/components/icons";

/** The feed is re-read often enough to feel live, cheaply enough to cache. */
export const revalidate = 30;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sort = parseSort((await searchParams).sort);
  const query = sort ? `?limit=12&sort=${sort}` : "?limit=12";

  const [feed, stats, session, guest] = await Promise.all([
    apiServer<Page<Timelapse>>(`/v1/timelapses${query}`),
    apiServer<Stats>("/v1/stats", 120),
    apiServer<SessionResponse>("/v1/auth/session", 0),
    isGuestPreview(),
  ]);

  const live = feed?.items ?? [];
  const apiDown = feed === null;
  // The demo library stands in when a guest would otherwise be staring at an
  // empty grid, and when the API cannot be reached at all — an outage should
  // not leave the front page looking broken. Real content always wins, every
  // demo record is labelled as one, and a signed-out visitor on a working but
  // empty site still sees the honest empty state.
  const preview = (guest || apiDown) && live.length === 0;
  const items = preview ? sampleFeed(sort) : live;
  const figures = stats && stats.publishedTimelapses > 0 ? stats : preview ? SAMPLE_STATS : null;

  return (
    <>
      <Hero
        signedIn={Boolean(session?.authenticated)}
        guest={guest}
        reel={preview ? [] : live}
        sample={preview}
      />
      {figures ? <StatBand stats={figures} sample={preview} /> : null}
      <Container>
        <Feed items={items} sort={sort} apiDown={apiDown} sample={preview} />
        <HowItWorks />
        <Principles />
        <ClosingCTA signedIn={Boolean(session?.authenticated)} guest={guest} />
      </Container>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The hero.
 *
 * Copy on the left, the product itself on the right: a reel of real sessions
 * playing one after another. The backdrop is a ruled grid that fades out
 * rather than a coloured bloom — structure instead of light.
 *
 * The second button is the one that matters for somebody who has just arrived.
 * Uploading needs an account; looking does not, and saying so next to the
 * action that would otherwise demand one is the only place that offer lands.
 */
function Hero({
  signedIn,
  guest,
  reel,
  sample,
}: {
  signedIn: boolean;
  guest: boolean;
  reel: Timelapse[];
  sample: boolean;
}) {
  return (
    <div className="grid-backdrop border-b border-border">
      <Container width="wide" className="py-12 sm:py-16 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <section className="lg:col-span-6">
            <p className="animate-fade-in-down inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-fg-muted">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              Timelapses of real work, reviewed by a person
            </p>

            <h1 className="animate-fade-in-up delay-1 text-display mt-6 font-semibold">
              Your hustle should be <span className="text-accent">paid off</span>.
            </h1>

            <p className="animate-fade-in-up delay-2 text-lede mt-5 max-w-lg text-fg-muted">
              Record the session, write down what you actually did, and publish it. The people who
              watch it can sponsor you in SOL — wallet to wallet, no cut taken — or hire you for
              the next one.
            </p>

            <div className="animate-fade-in-up delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ButtonLink href="/upload" size="lg" className="group w-full sm:w-auto">
                Upload a timelapse
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>

              {signedIn || guest ? (
                <ButtonLink href="/#feed" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Browse the feed
                </ButtonLink>
              ) : (
                <EnterGuestButton
                  next="/"
                  label="Look around first"
                  size="lg"
                  className="w-full sm:w-auto"
                />
              )}
            </div>

            <ul className="animate-fade-in-up delay-4 mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              <HeroPoint icon={<TrendingIcon size={15} />} title="0% cut" body="Every lamport reaches you" />
              <HeroPoint icon={<ShieldIcon size={15} />} title="Human review" body="Rejections carry a reason" />
              <HeroPoint icon={<WalletIcon size={15} />} title="Your keys" body="We never hold custody" />
            </ul>
          </section>

          <section className="animate-scale-in delay-2 lg:col-span-6">
            <HeroShowcase items={reel} fallback={SAMPLE_TIMELAPSES} sample={sample} />
          </section>
        </div>
      </Container>
    </div>
  );
}

function HeroPoint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li>
      <span className="text-accent">{icon}</span>
      <p className="mt-2 text-[13.5px] font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-fg-subtle">{body}</p>
    </li>
  );
}

/**
 * The one place raw totals appear.
 *
 * A band of hairline-separated figures rather than four cards: these are one
 * reading of the same thing, and boxing each of them separately says they are
 * four unrelated facts. Hours of recorded work leads, because that is what the
 * site is a record of; the SOL figure follows rather than the other way round.
 * Each figure counts up once, when it first scrolls into view.
 */
function StatBand({ stats, sample }: { stats: Stats; sample: boolean }) {
  const hours = Math.round(stats.sessionMinutesRecorded / 60);
  return (
    <div className="border-b border-border bg-surface">
      <Container className="py-8 sm:py-10">
        <Reveal>
          <div className="mb-6 flex items-center gap-3">
            <span className="text-eyebrow">By the numbers</span>
            {sample ? <SampleTag /> : null}
          </div>
          <dl className="figure-rail grid grid-cols-2 gap-y-8 sm:grid-cols-4">
            <Figure label="Hours recorded" value={<CountUp value={hours} format="count" />} />
            <Figure
              label="Timelapses published"
              value={<CountUp value={stats.publishedTimelapses} format="count" />}
            />
            <Figure label="Creators" value={<CountUp value={stats.creators} format="count" />} />
            <Figure
              label="Sent to creators"
              value={<CountUp value={stats.donationTotalLamports} format="sol" durationMs={1400} />}
              accent
            />
          </dl>
        </Reveal>
      </Container>
    </div>
  );
}

function Figure({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    // Padding and the divider rule both come from `.figure-rail`, so they stay
    // in step when the grid changes from four columns to two.
    <div>
      <dd
        className={
          "tnum text-[clamp(1.5rem,1.2rem+1.4vw,2.125rem)] font-semibold leading-none" +
          (accent ? " text-accent" : "")
        }
      >
        {value}
      </dd>
      <dt className="mt-2 text-[13px] leading-snug text-fg-muted">{label}</dt>
    </div>
  );
}

const STEPS = [
  {
    icon: UploadIcon,
    title: "Record and write it up",
    body: "Upload the session and say what you actually did. Point at the commit, the repo, the thing that moved.",
  },
  {
    icon: ShieldIcon,
    title: "A person reads it",
    body: "Nothing publishes itself. A reviewer checks the write-up against the work, and a rejection always comes back with a reason.",
  },
  {
    icon: WalletIcon,
    title: "Viewers fund it directly",
    body: "SOL moves from their wallet to yours. We never hold a key, never take a cut, and verify the transfer on-chain before crediting it.",
  },
];

/**
 * Three steps, revealed one after another as the section arrives.
 *
 * Set as a numbered sequence rather than three cards. The steps happen in an
 * order, and a row of identical boxes is the one layout that does not say so.
 */
function HowItWorks() {
  return (
    <section className="mt-20 sm:mt-28" aria-labelledby="how-heading">
      <Reveal>
        <p className="eyebrow-rule text-eyebrow">How it works</p>
        <h2 id="how-heading" className="text-title mt-4 font-semibold">
          Three steps, and one of them is a person
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">
          The review step is the whole product. Everything else is plumbing around it.
        </p>
      </Reveal>

      {/* Dividers rather than a one-pixel grid gap over a coloured ground: the
          steps fade in one after another, and a gap would show through as a
          grey slab for as long as a cell is still transparent. */}
      <ol
        className="mt-10 grid divide-y divide-border overflow-hidden rounded-[var(--radius-card)]
                   border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {STEPS.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 110}>
            <div className="h-full p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="tnum text-[26px] font-semibold leading-none text-border-strong">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-accent">
                  <step.icon size={16} />
                </span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

const PRINCIPLES = [
  {
    claim: "Nothing publishes itself",
    detail:
      "Published is set by one statement, behind the admin role, and every decision is written to an audit trail.",
  },
  {
    claim: "Rejections carry a reason",
    detail:
      "The API refuses a decline with no note, and so does a database constraint. Creators read the reason on their dashboard.",
  },
  {
    claim: "Donations never touch us",
    detail:
      "SOL moves wallet to wallet. No key is held, no cut is taken, and the transfer is verified on-chain before it is credited.",
  },
];

/**
 * The three properties the product is actually built on.
 *
 * Stated as claim and enforcement, because a promise about review is worth
 * nothing without the sentence explaining what stops it being broken.
 */
function Principles() {
  return (
    <section className="mt-20 sm:mt-28" aria-labelledby="principles-heading">
      <Reveal>
        <p className="eyebrow-rule text-eyebrow">What holds it together</p>
        <h2 id="principles-heading" className="text-title mt-4 font-semibold">
          Three promises, each with something enforcing it
        </h2>
      </Reveal>

      <dl className="mt-8 divide-y divide-border border-y border-border">
        {PRINCIPLES.map((principle, i) => (
          <Reveal key={principle.claim} delay={i * 90}>
            <div className="grid gap-2 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8 sm:py-6">
              <dt className="text-[15px] font-semibold">{principle.claim}</dt>
              <dd className="text-[14px] leading-relaxed text-fg-muted">{principle.detail}</dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

function Feed({
  items,
  sort,
  apiDown,
  sample,
}: {
  items: Timelapse[];
  sort: FeedSort;
  apiDown: boolean;
  sample: boolean;
}) {
  return (
    <section id="feed" className="mt-16 scroll-mt-24 sm:mt-24" aria-labelledby="feed-heading">
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-rule text-eyebrow">The feed</p>
            <h2 id="feed-heading" className="text-title mt-4 font-semibold">
              {sample ? "Demo sessions" : "Published work"}
              {items.length > 0 ? (
                <span className="tnum ml-3 align-middle text-[15px] font-normal text-fg-subtle">
                  {formatCount(items.length)}
                </span>
              ) : null}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-fg-muted">
              Hover a card to preview it. Every session here was read by a person before it went up.
            </p>
          </div>
          <FeedTabs active={sort} />
        </div>
      </Reveal>

      {apiDown ? (
        <ApiStatus className="mt-6" />
      ) : sample ? (
        <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
          <SampleTag>Demo</SampleTag>
          Invented sessions, shown so the layout has something in it. Real submissions replace
          them the moment there are any.
        </p>
      ) : null}

      <div className="mt-8">
        {items.length > 0 ? (
          <TimelapseGrid items={items} sample={sample} />
        ) : (
          <EmptyState
            title="Nothing published yet"
            description="Every timelapse here has been through review. The first ones are on their way."
            action={<ButtonLink href="/upload">Upload the first one</ButtonLink>}
          />
        )}
      </div>
    </section>
  );
}

function ClosingCTA({ signedIn, guest }: { signedIn: boolean; guest: boolean }) {
  return (
    <Reveal direction="scale">
      <section className="mb-20 mt-20 sm:mt-28">
        <div className="grid-backdrop rounded-[var(--radius-panel)] border border-border bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)] sm:px-12 sm:py-16">
          <p className="text-eyebrow">Start here</p>
          <h2 className="text-title mt-4 font-semibold">Ready to show your work?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-fg-muted">
            Record what you build, write what you learned, and let the people who watch it
            decide whether it was worth doing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/upload" size="lg" className="group w-full sm:w-auto">
              Start uploading
              <ArrowRightIcon size={16} className="nudge-icon" />
            </ButtonLink>
            {signedIn || guest ? (
              <ButtonLink
                href="/about"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Read how review works
              </ButtonLink>
            ) : (
              <EnterGuestButton
                next="/dashboard"
                label="See the creator dashboard"
                size="lg"
                className="w-full sm:w-auto"
              />
            )}
          </div>
          {!signedIn ? (
            <p className="mt-5 text-[13px] text-fg-subtle">
              Or read{" "}
              <Link href="/about" className="link-underline text-fg-muted hover:text-fg">
                how review works
              </Link>{" "}
              before you decide.
            </p>
          ) : null}
        </div>
      </section>
    </Reveal>
  );
}
