import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWatch } from "@/lib/data";
import { isSampleSlug } from "@/lib/demo/content";
import { formatCount, formatDate, formatDuration, formatSession, formatSol } from "@/lib/format";
import { DemoNote, DemoTag } from "@/components/demo/tag";
import { Reveal } from "@/components/motion/reveal";
import { BookmarkButton } from "@/components/timelapse/bookmark-button";
import { compression } from "@/components/timelapse/card";
import { TimelapsePlayer } from "@/components/timelapse/player";
import { PlayerSeekProvider } from "@/components/timelapse/player-seek";
import { ShareButton } from "@/components/timelapse/share-button";
import { DiscussionPanel } from "@/components/watch/discussion-panel";
import { DonatePanel, DonationsUnavailable, SupporterList } from "@/components/watch/donate-panel";
import { SessionInspector } from "@/components/watch/session-inspector";
import { UpNext } from "@/components/watch/up-next";
import { Avatar, Card, Container } from "@/components/ui";
import { ArrowLeftIcon, ExternalIcon, GitHubIcon, XIcon } from "@/components/ui/icons";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWatch(slug);
  if (!data) return { title: "Session" };
  const t = data.timelapse;
  if (isSampleSlug(slug)) return { title: `${t.title} (demo)`, robots: { index: false, follow: false } };
  return {
    title: t.title,
    description: t.summary.slice(0, 160),
    openGraph: { title: t.title, description: t.summary.slice(0, 160), type: "video.other" },
  };
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const data = await getWatch(slug);
  if (!data) notFound();

  const { timelapse: t, demo } = data;
  const ratio = compression(t);
  const facts = [
    { label: "Work session", value: t.sessionMinutes > 0 ? formatSession(t.sessionMinutes).replace(" of work", "") : "Not given" },
    { label: "Playback", value: formatDuration(t.durationSeconds) },
    { label: "Speed-up", value: ratio ? `${ratio}x` : "Real time" },
    { label: "Views", value: formatCount(t.viewCount) },
  ];

  return (
    <PlayerSeekProvider>
      <Container width="wide" className="pt-6 sm:pt-8">
        <Link
          href="/#feed"
          className="group inline-flex items-center gap-2 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeftIcon size={15} className="transition-transform group-hover:-translate-x-0.5" />
          Back to the feed
        </Link>

        <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0">
            <Reveal immediate y={16}>
              <TimelapsePlayer timelapse={t} />
            </Reveal>
            {demo ? (
              <DemoNote className="mt-4">
                A generated demo session, so the page has something real to play. Sponsoring and
                discussion are switched off here.
              </DemoNote>
            ) : null}

            <Reveal immediate delay={0.1} className="mt-8">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
                {t.publishedAt ? <time dateTime={t.publishedAt}>Published {formatDate(t.publishedAt)}</time> : null}
                {demo ? <DemoTag /> : null}
              </div>
              <h1 className="text-title mt-3 max-w-3xl">{t.title}</h1>

              <div className="mt-6 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                <CreatorLine creator={t.creator} linkable={!demo || isSampleSlug(t.slug)} />
                {demo ? null : (
                  <div className="flex items-center gap-2">
                    <ShareButton title={t.title} text={t.summary.slice(0, 120)} path={`/watch/${t.slug}`} />
                    <BookmarkButton timelapse={t} variant="inline" />
                  </div>
                )}
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-4">
                {facts.map((f) => (
                  <div key={f.label} className="bg-surface px-4 py-3.5">
                    <dt className="text-[12px] text-fg-subtle">{f.label}</dt>
                    <dd className="mt-1 font-mono text-[15px] tabular-nums text-fg">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal as="section" className="mt-10">
              <h2 className="text-eyebrow">What I did</h2>
              <div className="mt-4 max-w-[68ch] whitespace-pre-wrap text-[16px] leading-[1.75] text-fg">
                {t.summary}
              </div>
              <WorkLinks githubUrl={t.githubUrl} xUrl={t.xUrl} />
            </Reveal>

            <DiscussionPanel
              slug={t.slug}
              title={t.title}
              initialNotes={data.notes}
              signedIn={data.signedIn}
              demo={demo}
            />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Reveal immediate delay={0.15}>
              {demo ? (
                <Card className="p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                    Sponsor this work
                    <DemoTag />
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
                    On a real session this is where you choose an amount. Your wallet shows the
                    recipient before you approve, the SOL never passes through Sardhana, and the
                    transfer is verified on-chain before it is counted.
                  </p>
                </Card>
              ) : data.payoutAddress ? (
                <DonatePanel timelapse={t} payoutAddress={data.payoutAddress} />
              ) : (
                <DonationsUnavailable name={t.creator.displayName} />
              )}
            </Reveal>

            <Reveal delay={0.2}>
              <Card className="p-5 sm:p-6">
                <h2 className="flex items-baseline justify-between gap-2 text-[15px] font-semibold">
                  Sponsors
                  {t.donationTotalLamports > 0 ? (
                    <span className="font-mono text-[13px] font-normal tabular-nums text-fg-muted">
                      {formatSol(t.donationTotalLamports)}
                    </span>
                  ) : null}
                </h2>
                <div className="mt-2">
                  <SupporterList donations={data.donations} />
                </div>
              </Card>
            </Reveal>

            {demo ? null : <SessionInspector timelapse={t} siteUrl={SITE_URL} />}

            <Reveal delay={0.25}>
              <UpNext items={data.upNext} demo={demo} />
            </Reveal>
          </aside>
        </div>
      </Container>
    </PlayerSeekProvider>
  );
}

function CreatorLine({
  creator,
  linkable,
}: {
  creator: { handle: string; displayName: string; avatarUrl?: string };
  linkable: boolean;
}) {
  const inner = (
    <>
      <Avatar name={creator.displayName} src={creator.avatarUrl} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold">{creator.displayName}</span>
        <span className="block text-[13px] text-fg-muted">@{creator.handle}</span>
      </span>
    </>
  );
  if (!linkable) return <div className="flex items-center gap-3">{inner}</div>;
  return (
    <Link href={`/creator/${creator.handle}`} className="flex items-center gap-3 transition-opacity hover:opacity-80">
      {inner}
    </Link>
  );
}

function WorkLinks({ githubUrl, xUrl }: { githubUrl?: string; xUrl?: string }) {
  if (!githubUrl && !xUrl) return null;
  const links = [
    githubUrl ? { href: githubUrl, icon: <GitHubIcon size={15} />, label: githubUrl.replace(/^https:\/\/(www\.)?github\.com\//, "") } : null,
    xUrl ? { href: xUrl, icon: <XIcon size={13} />, label: xUrl.replace(/^https:\/\/(x|twitter)\.com\//, "@") } : null,
  ].filter((l): l is { href: string; icon: React.ReactElement; label: string } => l !== null);

  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="press inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          {l.icon}
          <span className="max-w-[26ch] truncate">{l.label}</span>
          <ExternalIcon size={13} className="text-fg-subtle" />
        </a>
      ))}
    </div>
  );
}
