import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { PublicUser, Timelapse } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { SAMPLE_TIMELAPSES, findSampleCreator } from "@/lib/sample";
import { formatDate, formatSol, shortAddress } from "@/lib/format";
import { TimelapseGrid } from "@/components/timelapse-card";
import { SampleNote } from "@/components/guest";
import { Avatar, Container, EmptyState } from "@/components/ui";

export const revalidate = 60;

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const live = await apiServer<PublicUser>(`/v1/creators/${handle}`);
  if (!live) {
    const sample = findSampleCreator(handle);
    return sample
      ? { title: `${sample.displayName} (sample)`, robots: { index: false, follow: false } }
      : { title: "Creator" };
  }
  return {
    title: live.displayName,
    description: live.bio ?? `Timelapses published by ${live.displayName}.`,
  };
}

export default async function CreatorPage({ params }: Props) {
  const { handle } = await params;
  const [live, timelapses] = await Promise.all([
    apiServer<PublicUser>(`/v1/creators/${handle}`),
    apiServer<{ items: Timelapse[] }>(`/v1/creators/${handle}/timelapses`),
  ]);

  // A sample profile exists only for the creators in the preview feed, and
  // only while a preview is running.
  // As on the watch page, demo creators resolve during a preview and while the
  // API is down, because the front page links to them in both cases.
  const apiDown = !live && (await apiServer<unknown>("/v1/stats", 60)) === null;
  const sample =
    !live && ((await isGuestPreview()) || apiDown) ? findSampleCreator(handle) : undefined;
  const creator = live ?? sample;
  if (!creator) notFound();

  const isSample = !live;
  const items = isSample
    ? SAMPLE_TIMELAPSES.filter((t) => t.creator.handle === handle)
    : (timelapses?.items ?? []);

  return (
    <Container className="py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={creator.displayName} src={creator.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-semibold leading-tight">{creator.displayName}</h1>
          <p className="mt-0.5 text-sm text-fg-muted">@{creator.handle}</p>
          {creator.bio ? (
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-fg-muted">
              {creator.bio}
            </p>
          ) : null}
        </div>
      </header>

      {isSample ? (
        <SampleNote className="mt-6">
          An invented creator from the preview feed. Real profiles look exactly like this.
        </SampleNote>
      ) : null}

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-border py-5">
        <Figure label="Published" value={String(creator.timelapseCount)} />
        <Figure label="Received" value={formatSol(creator.donationTotalLamports)} />
        <Figure label="Donations" value={String(creator.donationCount)} />
        <Figure label="Joined" value={formatDate(creator.joinedAt)} />
        {creator.payoutAddress ? (
          <Figure label="Wallet" value={shortAddress(creator.payoutAddress)} mono />
        ) : null}
      </dl>

      <section className="mt-10">
        <h2 className="mb-6 text-[19px] font-semibold">Timelapses</h2>
        {items.length > 0 ? (
          <TimelapseGrid items={items} sample={isSample} />
        ) : (
          <EmptyState
            title="Nothing published yet"
            description={`${creator.displayName} has not had a timelapse approved yet.`}
          />
        )}
      </section>
    </Container>
  );
}

function Figure({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dd
        className={
          "text-[17px] font-semibold tabular-nums leading-tight" + (mono ? " font-mono" : "")
        }
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-[13px] text-fg-muted">{label}</dt>
    </div>
  );
}
