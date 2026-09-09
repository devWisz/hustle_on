import { apiServer } from "@/lib/api";
import type { Page, Stats, Timelapse } from "@/lib/types";
import { formatCount, formatSol } from "@/lib/format";
import { TimelapseGrid } from "@/components/timelapse-card";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

export const revalidate = 30;

export default async function HomePage() {
  const [feed, stats] = await Promise.all([
    apiServer<Page<Timelapse>>("/v1/timelapses?limit=12"),
    apiServer<Stats>("/v1/stats", 120),
  ]);
  const items = feed?.items ?? [];

  return (
    <Container className="py-16 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
          Timelapses of real work, funded by the people who want to see more of it.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-fg-muted">
          Record a session. Write down what you actually did. Every upload is read by a person
          before it goes up, and anyone who thinks the work was worth it can send you SOL directly.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <ButtonLink href="/upload" size="lg">
            Upload a timelapse
          </ButtonLink>
          <ButtonLink href="/about" variant="secondary" size="lg">
            How it works
          </ButtonLink>
        </div>
      </section>

      {stats && stats.publishedTimelapses > 0 ? <StatLine stats={stats} /> : null}

      <section className="mt-16">
        <h2 className="mb-6 text-[19px] font-semibold">Recently published</h2>
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
    </Container>
  );
}

/**
 * The one place raw totals appear.
 *
 * Hours of recorded work leads, because that is what the site is a record of;
 * the SOL figure follows it rather than the other way round.
 */
function StatLine({ stats }: { stats: Stats }) {
  const hours = Math.round(stats.sessionMinutesRecorded / 60);
  return (
    <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 sm:grid-cols-4">
      <Figure label="Hours recorded" value={formatCount(hours)} />
      <Figure label="Timelapses published" value={formatCount(stats.publishedTimelapses)} />
      <Figure label="Creators" value={formatCount(stats.creators)} />
      <Figure label="Sent to creators" value={formatSol(stats.donationTotalLamports)} />
    </dl>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-[22px] font-semibold tabular-nums leading-tight">{value}</dd>
      <dt className="mt-0.5 text-[13px] text-fg-muted">{label}</dt>
    </div>
  );
}
