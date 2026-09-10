import { apiServer } from "@/lib/api";
import type { Page, Stats, Timelapse } from "@/lib/types";
import { formatCount, formatSol } from "@/lib/format";
import { TimelapseGrid } from "@/components/timelapse-card";
import { ButtonLink, Container, EmptyState, GlassStat } from "@/components/ui";
import { ClockIcon, EyeIcon, TrendingIcon, UsersIcon } from "@/components/icons";
import { HeroVisual } from "@/components/hero-visual";

export const revalidate = 30;

export default async function HomePage() {
  const [feed, stats] = await Promise.all([
    apiServer<Page<Timelapse>>("/v1/timelapses?limit=12"),
    apiServer<Stats>("/v1/stats", 120),
  ]);
  const items = feed?.items ?? [];

  return (
    <>
      {/* Hero section with gradient background glow */}
      <div className="hero-glow">
        <Container className="py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left side copy */}
            <section className="lg:col-span-7 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-6">
                <span>⚡ Proof of Work meets Solana Payouts</span>
              </div>
              <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[52px]">
                Timelapses of{" "}
                <span className="gradient-text">real work</span>
                , funded by the people who want to see more of it.
              </h1>
              <p className="mt-6 text-[17px] leading-relaxed text-fg-muted sm:text-[18px]">
                Record a session. Write down what you actually did. Every upload is read by a person
                before it goes up, and anyone who thinks the work was worth it can send you SOL directly.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/upload" size="lg">
                  Upload a timelapse
                </ButtonLink>
                <ButtonLink href="/about" variant="secondary" size="lg">
                  How it works
                </ButtonLink>
              </div>
            </section>

            {/* Right side hero visual */}
            <section className="lg:col-span-5 animate-fade-in">
              <HeroVisual />
            </section>
          </div>
        </Container>
      </div>

      <Container>
        {/* Stats section */}
        {stats && stats.publishedTimelapses > 0 ? <StatGrid stats={stats} /> : null}

        {/* Feed */}
        <section className="mt-16">
          <div className="flex items-center gap-2 mb-6">
            <TrendingIcon size={18} className="text-accent" />
            <h2 className="text-[19px] font-semibold">Recently published</h2>
          </div>
          {items.length > 0 ? (
            <TimelapseGrid items={items} />
          ) : (
            <EmptyState
              title="Nothing published yet"
              description="Every timelapse here has been through review. The first ones are on their way."
              action={<ButtonLink href="/upload">Upload the first one</ButtonLink>}
            />
          )}
        </section>

        {/* CTA section at bottom */}
        <section className="mt-24 mb-12">
          <div className="glass rounded-[var(--radius-panel)] p-8 sm:p-12 text-center">
            <h2 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
              Ready to share your work?
            </h2>
            <p className="mt-3 mx-auto max-w-lg text-[15px] text-fg-muted">
              Record what you build, write what you learned, and let the community decide if it was worth doing.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/upload" size="lg">
                Start uploading
              </ButtonLink>
              <ButtonLink href="/about" variant="secondary" size="lg">
                Learn more
              </ButtonLink>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}

/**
 * The one place raw totals appear.
 *
 * Hours of recorded work leads, because that is what the site is a record of;
 * the SOL figure follows it rather than the other way round.
 */
function StatGrid({ stats }: { stats: Stats }) {
  const hours = Math.round(stats.sessionMinutesRecorded / 60);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 stagger-children">
      <GlassStat
        label="Hours recorded"
        value={formatCount(hours)}
        icon={<ClockIcon size={18} />}
      />
      <GlassStat
        label="Timelapses published"
        value={formatCount(stats.publishedTimelapses)}
        icon={<EyeIcon size={18} />}
      />
      <GlassStat
        label="Creators"
        value={formatCount(stats.creators)}
        icon={<UsersIcon size={18} />}
      />
      <GlassStat
        label="Sent to creators"
        value={formatSol(stats.donationTotalLamports)}
        icon={<TrendingIcon size={18} />}
      />
    </dl>
  );
}
