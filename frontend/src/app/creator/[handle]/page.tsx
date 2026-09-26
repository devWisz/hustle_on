import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreator } from "@/lib/data";
import { formatDate, shortAddress } from "@/lib/format";
import { DemoNote } from "@/components/demo/tag";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { TimelapseGrid } from "@/components/timelapse/grid";
import { Avatar, Container, EmptyState } from "@/components/ui";
import { FilmIcon } from "@/components/ui/icons";

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const result = await getCreator(handle);
  if (!result) return { title: "Creator" };
  const { creator } = result.data;
  if (result.demo) return { title: `${creator.displayName} (demo)`, robots: { index: false, follow: false } };
  return { title: creator.displayName, description: creator.bio ?? `Sessions published by ${creator.displayName}.` };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  const result = await getCreator(handle);
  if (!result) notFound();
  const { creator, items } = result.data;
  const hours = Math.round(items.reduce((n, t) => n + t.sessionMinutes, 0) / 60);

  return (
    <>
      <section className="grid-backdrop border-b border-border">
        <Container width="wide" className="pb-12 pt-12 sm:pb-16 sm:pt-20">
          <Reveal immediate>
            <Avatar name={creator.displayName} src={creator.avatarUrl} size={88} />
          </Reveal>
          <SplitHeading as="h1" onScroll={false} className="text-headline mt-8">
            {creator.displayName}
          </SplitHeading>
          <Reveal immediate delay={0.3}>
            <p className="mt-3 font-mono text-[13px] text-fg-subtle">
              @{creator.handle} · joined {formatDate(creator.joinedAt)}
              {creator.payoutAddress ? ` · ${shortAddress(creator.payoutAddress)}` : ""}
            </p>
            {creator.bio ? (
              <p className="text-lede mt-6 max-w-2xl text-fg-muted">{creator.bio}</p>
            ) : null}
          </Reveal>

          <Reveal as="dl" stagger={0.08} className="mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { label: "Sessions", value: <CountUp value={creator.timelapseCount} format="plain" /> },
              { label: "Hours recorded", value: <CountUp value={hours} format="plain" /> },
              { label: "Sponsorships", value: <CountUp value={creator.donationCount} format="plain" /> },
              { label: "Raised", value: <CountUp value={creator.donationTotalLamports} format="sol" /> },
            ].map((f) => (
              <div key={f.label} className="border-l border-border pl-4">
                <dd className="tnum text-[clamp(1.4rem,1.1rem+1.2vw,2rem)] font-semibold leading-none tracking-tight">{f.value}</dd>
                <dt className="mt-2 text-[12.5px] text-fg-muted">{f.label}</dt>
              </div>
            ))}
          </Reveal>
        </Container>
      </section>

      <Container width="wide" className="pt-12 sm:pt-16">
        {result.demo ? (
          <DemoNote className="mb-10">A demo creator from the sample library. Real profiles look exactly like this.</DemoNote>
        ) : null}
        <h2 className="text-title">Sessions</h2>
        <div className="mt-8">
          {items.length > 0 ? (
            <TimelapseGrid items={items} demo={result.demo} />
          ) : (
            <EmptyState
              icon={<FilmIcon size={18} />}
              title="Nothing published yet"
              description={`${creator.displayName} has not had a session approved yet.`}
            />
          )}
        </div>
      </Container>
    </>
  );
}
