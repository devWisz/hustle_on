import { apiServer } from "@/lib/api";
import type { Page, Stats, Timelapse } from "@/lib/types";
import { TimelapseGrid } from "@/components/timelapse-card";
import { ButtonLink, Container, EmptyState, GlassStat } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { FeedTabs, parseSort, type FeedSort } from "@/components/feed-tabs";
import { HeroVisual } from "@/components/hero-visual";
import {
  ArrowRightIcon,
  ClockIcon,
  EyeIcon,
  ShieldIcon,
  TrendingIcon,
  UploadIcon,
  UsersIcon,
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

  const [feed, stats] = await Promise.all([
    apiServer<Page<Timelapse>>(`/v1/timelapses${query}`),
    apiServer<Stats>("/v1/stats", 120),
  ]);
  const items = feed?.items ?? [];

  return (
    <>
      <Hero />
      <Container>
        {stats && stats.publishedTimelapses > 0 ? <StatGrid stats={stats} /> : null}
        <HowItWorks />
        <Feed items={items} sort={sort} apiReachable={feed !== null} />
        <ClosingCTA />
      </Container>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The hero.
 *
 * The backdrop is a ruled grid that fades out rather than a coloured bloom:
 * it gives the section an edge without putting light where no light source
 * exists, and it costs nothing on a phone.
 */
function Hero() {
  return (
    <div className="grid-backdrop border-b border-border">
      <Container className="py-12 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <section className="lg:col-span-7">
            <p className="animate-fade-in-down inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-fg-muted">
              <ShieldIcon size={13} className="text-accent" />
              Every upload read by a person before it goes up
            </p>

            <h1 className="animate-fade-in-up delay-1 text-display mt-6 font-semibold">
              Timelapses of <span className="text-accent">real work</span>, funded by the
              people who want to see more of it.
            </h1>

            <p className="animate-fade-in-up delay-2 text-lede mt-6 max-w-xl text-fg-muted">
              Record a session. Write down what you actually did. Anyone who thinks the work
              was worth it sends you SOL directly — wallet to wallet, no cut taken.
            </p>

            <div className="animate-fade-in-up delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ButtonLink href="/upload" size="lg" className="group w-full sm:w-auto">
                Upload a timelapse
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>
              <ButtonLink
                href="/about"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                How it works
              </ButtonLink>
            </div>

            <ul className="animate-fade-in-up delay-4 mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-fg-subtle">
              <li className="flex items-center gap-1.5">
                <WalletIcon size={14} /> No custody of your keys
              </li>
              <li className="flex items-center gap-1.5">
                <TrendingIcon size={14} /> 0% platform cut
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldIcon size={14} /> Rejections carry a reason
              </li>
            </ul>
          </section>

          <section className="animate-fade-in delay-2 lg:col-span-5">
            <HeroVisual />
          </section>
        </div>
      </Container>
    </div>
  );
}

/**
 * The one place raw totals appear.
 *
 * Hours of recorded work leads, because that is what the site is a record of;
 * the SOL figure follows it rather than the other way round. Each figure counts
 * up once, when it first scrolls into view.
 */
function StatGrid({ stats }: { stats: Stats }) {
  const hours = Math.round(stats.sessionMinutesRecorded / 60);
  const sol = stats.donationTotalLamports;
  return (
    <Reveal>
      <dl className="mt-12 grid grid-cols-2 gap-3 sm:mt-16 sm:grid-cols-4 sm:gap-4">
        <GlassStat
          label="Hours recorded"
          icon={<ClockIcon size={18} />}
          value={<CountUp value={hours} format="count" />}
        />
        <GlassStat
          label="Timelapses published"
          icon={<EyeIcon size={18} />}
          value={<CountUp value={stats.publishedTimelapses} format="count" />}
        />
        <GlassStat
          label="Creators"
          icon={<UsersIcon size={18} />}
          value={<CountUp value={stats.creators} format="count" />}
        />
        <GlassStat
          label="Sent to creators"
          icon={<TrendingIcon size={18} />}
          value={<CountUp value={sol} format="sol" durationMs={1400} />}
        />
      </dl>
    </Reveal>
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

/** Three steps, revealed one after another as the section arrives. */
function HowItWorks() {
  return (
    <section className="mt-20 sm:mt-28" aria-labelledby="how-heading">
      <Reveal>
        <h2 id="how-heading" className="text-title font-semibold">
          Three steps, and one of them is a person
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-muted">
          The review step is the whole product. Everything else is plumbing around it.
        </p>
      </Reveal>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
        {STEPS.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 110}>
            <div className="card-hover h-full rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <step.icon size={17} />
                </span>
                <span className="tnum text-[12px] font-medium text-fg-subtle">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function Feed({
  items,
  sort,
  apiReachable,
}: {
  items: Timelapse[];
  sort: FeedSort;
  apiReachable: boolean;
}) {
  return (
    <section id="feed" className="mt-20 scroll-mt-24 sm:mt-28">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-title font-semibold">Published work</h2>
          <FeedTabs active={sort} />
        </div>
      </Reveal>

      <div className="mt-8">
        {items.length > 0 ? (
          <TimelapseGrid items={items} />
        ) : apiReachable ? (
          <EmptyState
            title="Nothing published yet"
            description="Every timelapse here has been through review. The first ones are on their way."
            action={<ButtonLink href="/upload">Upload the first one</ButtonLink>}
          />
        ) : (
          // An unreachable API is a different situation from an empty feed, and
          // telling somebody their work does not exist when the server is simply
          // down is the wrong answer.
          <EmptyState
            title="The feed is not loading"
            description="We could not reach the API just now. Nothing is lost — try again in a moment."
            action={<ButtonLink href="/">Retry</ButtonLink>}
          />
        )}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <Reveal direction="scale">
      <section className="mb-16 mt-20 sm:mt-28">
        <div className="glass rounded-[var(--radius-panel)] px-6 py-10 text-center shadow-[var(--shadow-card)] sm:px-12 sm:py-14">
          <h2 className="text-title font-semibold">Ready to show your work?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-fg-muted">
            Record what you build, write what you learned, and let the people who watch it
            decide whether it was worth doing.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/upload" size="lg" className="group w-full sm:w-auto">
              Start uploading
              <ArrowRightIcon size={16} className="nudge-icon" />
            </ButtonLink>
            <ButtonLink
              href="/about"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Read how review works
            </ButtonLink>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
