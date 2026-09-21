import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Donation, Timelapse } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { findSampleTimelapse, isSampleSlug, sampleDonations } from "@/lib/sample";
import { formatCount, formatDate, formatSession, formatSol } from "@/lib/format";
import { TimelapsePlayer } from "@/components/timelapse-player";
import { DonatePanel, DonationsUnavailable, SupporterList } from "@/components/donate-panel";
import { ShareButton } from "@/components/share-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { SessionInspector } from "@/components/session-inspector";
import { DiscussionPanel } from "@/components/discussion-panel";
import { SampleNote, SampleTag } from "@/components/guest";
import { ThumbArtwork } from "@/components/thumb";
import { Avatar, Card, Container } from "@/components/ui";
import { ClockIcon, EyeIcon, GitHubIcon, PlayIcon, XIcon } from "@/components/icons";

export const revalidate = 30;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = (await apiServer<Timelapse>(`/v1/timelapses/${slug}`)) ?? findSampleTimelapse(slug);
  if (!t) return { title: "Timelapse" };
  // A sample page is a preview surface, never something a search engine should
  // be offering as a real record of somebody's work.
  if (isSampleSlug(slug)) {
    return { title: `${t.title} (sample)`, robots: { index: false, follow: false } };
  }
  return {
    title: t.title,
    description: t.summary.slice(0, 160),
    openGraph: { title: t.title, description: t.summary.slice(0, 160), type: "video.other" },
  };
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const live = await apiServer<Timelapse>(`/v1/timelapses/${slug}`);

  // Sample records resolve only inside a preview. Outside one the slug is just
  // a slug the API does not know, which is a 404 like any other.
  const sample = !live && isSampleSlug(slug) && (await isGuestPreview())
    ? findSampleTimelapse(slug)
    : undefined;

  const timelapse = live ?? sample;
  if (!timelapse) notFound();

  const isSample = !live;
  const [creator, donations] = isSample
    ? [undefined, { items: sampleDonations(slug) } as { items: Donation[] }]
    : await Promise.all([
        apiServer<{ payoutAddress?: string }>(`/v1/creators/${timelapse.creator.handle}`, 120),
        apiServer<{ items: Donation[] }>(`/v1/timelapses/${slug}/donations`),
      ]);

  return (
    <Container width="wide" className="py-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="animate-fade-in-up min-w-0">
          {isSample ? (
            <SamplePlayer timelapse={timelapse} />
          ) : (
            <TimelapsePlayer timelapse={timelapse} />
          )}

          <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">
            {timelapse.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fg-muted">
            {timelapse.sessionMinutes > 0 ? (
              <span className="flex items-center gap-1.5">
                <ClockIcon size={14} />
                {formatSession(timelapse.sessionMinutes)}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 tabular-nums">
              <EyeIcon size={14} />
              {formatCount(timelapse.viewCount)} views
            </span>
            {timelapse.publishedAt ? (
              <time dateTime={timelapse.publishedAt}>{formatDate(timelapse.publishedAt)}</time>
            ) : null}
            {isSample ? null : (
              <ShareButton
                title={timelapse.title}
                text={timelapse.summary.slice(0, 120)}
                path={`/watch/${timelapse.slug}`}
              />
            )}
          </div>

          <CreatorLine timelapse={timelapse} linkable={!isSample} />

          {/* The write-up is the substance of a submission, so it gets the
              width and the leading of something meant to be read. */}
          <section className="mt-8">
            <h2 className="text-eyebrow">What I did</h2>
            <div className="mt-4 max-w-[68ch] whitespace-pre-wrap text-[15px] leading-[1.7] text-fg">
              {timelapse.summary}
            </div>
          </section>

          <WorkLinks timelapse={timelapse} />
        </div>

        <aside
          className="animate-slide-in-right space-y-6 lg:sticky lg:top-20 lg:self-start"
          style={{ animationDelay: "200ms" }}
        >
          {isSample ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                Support this work
                <SampleTag />
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                On a real timelapse this is where the amount goes. Your wallet shows exactly where
                the SOL is going before you approve anything, it never passes through Sardhana, and
                the transfer is checked on-chain before it is credited.
              </p>
              <p className="mt-3 text-[13px] text-fg-subtle">
                Disabled here — there is no creator behind an invented record.
              </p>
            </Card>
          ) : creator?.payoutAddress ? (
            <DonatePanel timelapse={timelapse} />
          ) : (
            <DonationsUnavailable handle={timelapse.creator.displayName} />
          )}

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">
              Supporters
              {timelapse.donationTotalLamports > 0 ? (
                <span className="ml-2 font-normal tabular-nums text-accent">
                  {formatSol(timelapse.donationTotalLamports)}
                </span>
              ) : null}
            </h2>
            <div className="mt-2">
              <SupporterList donations={donations?.items ?? []} />
            </div>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

/**
 * The frame a sample timelapse gets in place of a player.
 *
 * There is no file behind an invented record, and a dead `<video>` element
 * with a broken source is a worse answer than saying so plainly.
 */
function SamplePlayer({ timelapse }: { timelapse: Timelapse }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border">
        <div className="aspect-video w-full">
          <ThumbArtwork
            seed={timelapse.slug}
            title={timelapse.title}
            creator={timelapse.creator.displayName}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-fg-subtle shadow-[var(--shadow-raised)]">
            <PlayIcon size={20} />
          </span>
        </div>
      </div>
      <SampleNote className="mt-3">
        An invented session, shown so the page has something on it. There is no video behind it —
        a real submission plays here.
      </SampleNote>
    </div>
  );
}

function CreatorLine({ timelapse, linkable }: { timelapse: Timelapse; linkable: boolean }) {
  const inner = (
    <>
      <Avatar name={timelapse.creator.displayName} src={timelapse.creator.avatarUrl} size={36} />
      <span>
        <span className="block text-sm font-medium">{timelapse.creator.displayName}</span>
        <span className="block text-[13px] text-fg-muted">@{timelapse.creator.handle}</span>
      </span>
    </>
  );

  if (!linkable) {
    return (
      <div className="mt-5 flex items-center gap-3 border-y border-border py-4">{inner}</div>
    );
  }

  return (
    <Link
      href={`/creator/${timelapse.creator.handle}`}
      className="-mx-3 mt-5 flex items-center gap-3 rounded-[var(--radius-control)] border-y border-border
                 px-3 py-4 transition-all duration-200 hover:bg-surface-raised/50 hover:text-accent"
    >
      {inner}
    </Link>
  );
}

/**
 * Where the work can be checked.
 *
 * Both links are optional, so the section disappears entirely rather than
 * leaving two disabled buttons behind.
 */
function WorkLinks({ timelapse }: { timelapse: Timelapse }) {
  if (!timelapse.githubUrl && !timelapse.xUrl) return null;
  return (
    <section className="mt-8">
      <h2 className="text-eyebrow">Where this work lives</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {timelapse.githubUrl ? (
          <WorkLink href={timelapse.githubUrl} icon={<GitHubIcon size={15} />} label="GitHub" />
        ) : null}
        {timelapse.xUrl ? (
          <WorkLink href={timelapse.xUrl} icon={<XIcon size={14} />} label="X" />
        ) : null}
      </div>
    </section>
  );
}

function WorkLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      // noopener is what stops the opened page from reaching back into this
      // one through window.opener; noreferrer keeps our URL out of its logs.
      rel="noopener noreferrer nofollow"
      className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border
                 px-3 text-[13px] text-fg-muted transition-all duration-200
                 hover:border-border-strong hover:text-fg"
    >
      {icon}
      {label}
      <span className="max-w-[22ch] truncate text-fg-subtle">
        {href.replace(/^https:\/\/(www\.)?/, "")}
      </span>
    </a>
  );
}
