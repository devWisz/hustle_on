import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Page, PublicUser, SelfUser, Video } from "@/lib/types";
import { VideoGrid } from "@/components/video-card";
import { SocialLinks } from "@/components/social-links";
import { FollowButton } from "@/components/follow-button";
import { SponsorPanel } from "@/components/sponsor-panel";
import { Avatar, Badge, ButtonLink, Card, Container, EmptyState, Stat } from "@/components/ui";
import { UploadIcon } from "@/components/icons";
import { formatCount, formatDate, formatSol, formatUsd, shortAddress } from "@/lib/format";

interface CreatorResponse {
  creator: PublicUser;
  isFollowing: boolean;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await apiServer<CreatorResponse>(`/v1/creators/${handle}`);
  if (!data) return { title: "Profile not found" };

  return {
    title: `${data.creator.displayName} (@${data.creator.handle})`,
    description:
      data.creator.headline ??
      `${data.creator.displayName} publishes their work sessions on Sardhana.`,
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const [data, videos, session] = await Promise.all([
    apiServer<CreatorResponse>(`/v1/creators/${handle}`, 30),
    apiServer<Page<Video>>(`/v1/creators/${handle}/videos?limit=12`, 30),
    apiServer<SessionResponse>("/v1/auth/session", 0),
  ]);

  if (!data) notFound();
  const { creator, isFollowing } = data;
  const viewer = session?.authenticated ? session.user : undefined;
  const isSelf = viewer?.id === creator.id;

  return (
    <>
      <div
        className="h-32 border-b border-border bg-surface-raised sm:h-44"
        style={
          creator.bannerUrl
            ? { backgroundImage: `url(${creator.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
        aria-hidden
      />

      <Container width="wide" className="pb-16">
        <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <span className="rounded-full ring-4 ring-bg">
              <Avatar name={creator.displayName} src={creator.avatarUrl} size={88} />
            </span>
            <div className="pb-1">
              <h1 className="text-[24px] font-semibold leading-tight tracking-tight">
                {creator.displayName}
              </h1>
              <p className="text-sm text-fg-subtle">@{creator.handle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1">
            {isSelf ? (
              <ButtonLink href="/settings" variant="secondary" size="sm">
                Edit profile
              </ButtonLink>
            ) : (
              <FollowButton
                handle={creator.handle}
                signedIn={Boolean(viewer)}
                initiallyFollowing={isFollowing}
              />
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {creator.headline ? (
              <p className="text-[15px] font-medium">{creator.headline}</p>
            ) : null}
            {creator.bio ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                {creator.bio}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {creator.openToWork ? <Badge tone="accent">Open to work</Badge> : null}
              {creator.location ? <Badge>{creator.location}</Badge> : null}
              {creator.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>

            <div className="mt-5">
              <SocialLinks links={creator.socialLinks} />
            </div>

            <section className="mt-10" aria-labelledby="sessions-heading">
              <h2 id="sessions-heading" className="mb-5 text-[17px] font-semibold">
                Sessions
              </h2>
              {videos && videos.items.length > 0 ? (
                <VideoGrid videos={videos.items} />
              ) : (
                <Card>
                  <EmptyState
                    icon={<UploadIcon size={24} />}
                    title={isSelf ? "You have not published a session yet" : "No published sessions yet"}
                    description={
                      isSelf
                        ? "Record a work session, upload the timelapse, and it appears here."
                        : "When this person publishes their first session it will show up here."
                    }
                    action={isSelf ? <ButtonLink href="/upload">Upload a session</ButtonLink> : undefined}
                  />
                </Card>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Sessions" value={formatCount(creator.videoCount)} />
                <Stat label="Followers" value={formatCount(creator.followerCount)} />
                <Stat label="Sponsored" value={formatSol(creator.sponsorTotalLamports)} />
                <Stat
                  label={creator.hourlyRateUsd ? "Rate" : "Joined"}
                  value={
                    creator.hourlyRateUsd
                      ? `${formatUsd(creator.hourlyRateUsd)}/hr`
                      : formatDate(creator.joinedAt)
                  }
                />
              </div>
              {creator.primaryWallet ? (
                <p className="mt-5 border-t border-border pt-4 font-mono text-[11px] text-fg-subtle">
                  {shortAddress(creator.primaryWallet)}
                </p>
              ) : null}
            </Card>

            {!isSelf ? (
              <SponsorPanel
                creatorHandle={creator.handle}
                creatorName={creator.displayName}
                hasWallet={Boolean(creator.primaryWallet)}
              />
            ) : null}

            {creator.openToWork && !isSelf ? (
              <Card className="p-5">
                <h2 className="text-[15px] font-semibold">Hire {creator.displayName.split(" ")[0]}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
                  Post a role and invite them to apply. Funds sit in escrow until you release each
                  milestone.
                </p>
                <ButtonLink href="/jobs/new" size="sm" className="mt-4 w-full">
                  Post a role
                </ButtonLink>
              </Card>
            ) : null}
          </aside>
        </div>
      </Container>
    </>
  );
}
