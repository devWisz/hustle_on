import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Comment, Page, SelfUser, Sponsorship, Video } from "@/lib/types";
import { Avatar, Badge, Card, Container } from "@/components/ui";
import { SponsorPanel } from "@/components/sponsor-panel";
import { CommentThread } from "@/components/comment-thread";
import { FollowButton } from "@/components/follow-button";
import { ReportButton } from "@/components/report-button";
import { TimelapsePlayer } from "@/components/timelapse-player";
import { ClockIcon } from "@/components/icons";
import { formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = await apiServer<Video>(`/v1/videos/${slug}`);
  if (!video) return { title: "Session not found" };

  return {
    title: video.title,
    description: video.description?.slice(0, 160) ?? `A work session by ${video.creator.displayName}.`,
    openGraph: {
      title: video.title,
      description: video.description?.slice(0, 160),
      images: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
      type: "video.other",
    },
  };
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [video, comments, sponsors, session] = await Promise.all([
    apiServer<Video>(`/v1/videos/${slug}`, 15),
    apiServer<Page<Comment>>(`/v1/videos/${slug}/comments?limit=25`, 0),
    apiServer<Page<Sponsorship>>(`/v1/videos/${slug}/sponsors?limit=8`, 15),
    apiServer<SessionResponse>("/v1/auth/session", 0),
  ]);

  if (!video) notFound();
  const viewer = session?.authenticated ? session.user : undefined;

  return (
    <Container width="wide" className="py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <TimelapsePlayer video={video} />

          <h1 className="mt-6 text-[24px] font-semibold leading-snug tracking-tight">{video.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
            <span>{formatCount(video.viewCount)} views</span>
            {video.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>{timeAgo(video.publishedAt)}</span>
              </>
            ) : null}
            {video.sessionMinutes ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon size={14} />
                  {formatSession(video.sessionMinutes)}
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
            <div className="flex items-center gap-3">
              <Link href={`/creator/${video.creator.handle}`}>
                <Avatar name={video.creator.displayName} src={video.creator.avatarUrl} size={40} />
              </Link>
              <div>
                <Link
                  href={`/creator/${video.creator.handle}`}
                  className="text-sm font-medium hover:text-accent"
                >
                  {video.creator.displayName}
                </Link>
                <p className="text-[13px] text-fg-subtle">@{video.creator.handle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FollowButton
                handle={video.creator.handle}
                signedIn={Boolean(viewer)}
                isSelf={viewer?.id === video.creator.id}
              />
              <ReportButton subjectType="video" subjectId={video.id} signedIn={Boolean(viewer)} />
            </div>
          </div>

          {video.description ? (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
              {video.description}
            </div>
          ) : null}

          {video.tags.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {video.tags.map((tag) => (
                <li key={tag}>
                  <Link href={`/discover?tag=${tag}`}>
                    <Badge>{tag}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <CommentThread
            slug={slug}
            initialComments={comments?.items ?? []}
            signedIn={Boolean(viewer)}
            currentUserId={viewer?.id}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <SponsorPanel
            creatorHandle={video.creator.handle}
            creatorName={video.creator.displayName}
            videoId={video.id}
            hasWallet={Boolean(video.creator.wallet)}
          />
          <SponsorList sponsors={sponsors?.items ?? []} total={video.sponsorTotalLamports} />
        </aside>
      </div>
    </Container>
  );
}


function SponsorList({ sponsors, total }: { sponsors: Sponsorship[]; total: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Sponsors</h2>
        <span className="text-sm font-medium tabular-nums text-accent">{formatSol(total)}</span>
      </div>

      {sponsors.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
          No sponsorships yet. The first one shows up here immediately after it settles.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {sponsors.map((sponsor) => (
            <li key={sponsor.id} className="flex gap-3">
              <Avatar
                name={sponsor.sponsor?.displayName ?? "Anonymous"}
                src={sponsor.sponsor?.avatarUrl}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium">
                    {sponsor.sponsor ? (
                      <Link href={`/creator/${sponsor.sponsor.handle}`} className="hover:text-accent">
                        {sponsor.sponsor.displayName}
                      </Link>
                    ) : (
                      "Anonymous"
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-fg-muted">
                    {formatSol(sponsor.amount)}
                  </span>
                </p>
                {sponsor.message ? (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{sponsor.message}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
