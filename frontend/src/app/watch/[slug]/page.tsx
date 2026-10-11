import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWatch } from "@/lib/data";
import { formatCount, formatDate, formatDuration, formatSession, formatSol } from "@/lib/format";
import { Reveal } from "@/components/motion/reveal";
import { BookmarkButton } from "@/components/timelapse/bookmark-button";
import { compression } from "@/components/timelapse/card";
import { TimelapsePlayer } from "@/components/timelapse/player";
import { PlayerSeekProvider } from "@/components/timelapse/player-seek";
import { ShareButton } from "@/components/timelapse/share-button";
import { DiscussionPanel } from "@/components/watch/discussion-panel";
import {
  DonatePanel,
  DonationsUnavailable,
  SponsorSignIn,
  SupporterList,
} from "@/components/watch/donate-panel";
import { ShareCard } from "@/components/watch/share-card";
import { ReportButton } from "@/components/watch/report-button";
import { UpNext } from "@/components/watch/up-next";
import { Avatar, Card, Container, buttonClass } from "@/components/ui";
import {
  ArrowLeftIcon,
  ExternalIcon,
  GitHubIcon,
  SolanaIcon,
  XIcon,
} from "@/components/ui/icons";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWatch(slug);
  if (!data) return { title: "Session" };
  const t = data.timelapse;
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

  const t = data.timelapse;
  const ratio = compression(t);
  const facts = [
    {
      label: "Work session",
      value:
        t.sessionMinutes > 0
          ? formatSession(t.sessionMinutes).replace(" of work", "")
          : "Not given",
    },
    { label: "Playback", value: formatDuration(t.durationSeconds) },
    { label: "Sped up", value: ratio ? `${ratio}×` : "Real time" },
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

        {/*
          One grid, three areas. On a phone they stack in source order, so the
          sponsor panel sits right after the write-up instead of below the whole
          discussion. From lg the sidebar spans both rows beside the main column.
        */}
        <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-0">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Reveal immediate y={16}>
              <TimelapsePlayer timelapse={t} />
            </Reveal>

            <Reveal immediate delay={0.1} className="mt-8">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
                {t.publishedAt ? (
                  <time dateTime={t.publishedAt}>Published {formatDate(t.publishedAt)}</time>
                ) : null}
              </div>
              <h1 className="text-title mt-3 max-w-3xl">{t.title}</h1>

              <div className="mt-6 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                <CreatorLine creator={t.creator} />
                <div className="flex flex-wrap items-center gap-2">
                  {data.payoutAddress && !data.isOwner ? (
                    <a href="#sponsor" className={buttonClass("primary", "sm")}>
                      <SolanaIcon size={12} />
                      Sponsor
                    </a>
                  ) : null}
                  <ShareButton
                    title={t.title}
                    text={t.summary.slice(0, 120)}
                    path={`/watch/${t.slug}`}
                  />
                  <BookmarkButton timelapse={t} variant="inline" />
                  <ReportButton slug={t.slug} signedIn={data.signedIn} />
                </div>
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
          </div>

          <aside className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Reveal immediate delay={0.15} id="sponsor" className="scroll-mt-24">
              {!data.payoutAddress ? (
                <DonationsUnavailable name={t.creator.displayName} />
              ) : !data.signedIn ? (
                <SponsorSignIn slug={t.slug} name={t.creator.displayName} />
              ) : data.isOwner ? (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-[16px] font-semibold">This is your session</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                    Viewers see the sponsor form here. Sponsorships you receive are listed on your
                    dashboard.
                  </p>
                </Card>
              ) : (
                <DonatePanel timelapse={t} payoutAddress={data.payoutAddress} />
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

            <ShareCard timelapse={t} siteUrl={SITE_URL} />

            <Reveal delay={0.25}>
              <UpNext items={data.upNext} />
            </Reveal>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <DiscussionPanel
              slug={t.slug}
              title={t.title}
              initialNotes={data.notes}
              signedIn={data.signedIn}
            />
          </div>
        </div>
      </Container>
    </PlayerSeekProvider>
  );
}

function CreatorLine({
  creator,
}: {
  creator: { handle: string; displayName: string; avatarUrl?: string };
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
  return (
    <Link
      href={`/creator/${creator.handle}`}
      className="flex items-center gap-3 transition-opacity hover:opacity-80"
    >
      {inner}
    </Link>
  );
}

function WorkLinks({ githubUrl, xUrl }: { githubUrl?: string; xUrl?: string }) {
  if (!githubUrl && !xUrl) return null;
  const links = [
    githubUrl
      ? {
          href: githubUrl,
          icon: <GitHubIcon size={15} />,
          label: githubUrl.replace(/^https:\/\/(www\.)?github\.com\//, ""),
        }
      : null,
    xUrl
      ? {
          href: xUrl,
          icon: <XIcon size={13} />,
          label: xUrl.replace(/^https:\/\/(x|twitter)\.com\//, "@"),
        }
      : null,
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
