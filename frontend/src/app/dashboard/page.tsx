import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Notification, Page, SelfUser, Sponsorship, Video } from "@/lib/types";
import { VideoGrid } from "@/components/video-card";
import { Avatar, Badge, ButtonLink, Card, Container, EmptyState, Stat } from "@/components/ui";
import { BellIcon, UploadIcon } from "@/components/icons";
import { formatCount, formatSol, timeAgo } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export default async function DashboardPage() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  if (!session?.authenticated || !session.user) redirect("/login?next=/dashboard");

  const me = session.user;
  const [videos, sponsorships, notifications] = await Promise.all([
    apiServer<Page<Video>>(`/v1/creators/${me.handle}/videos?limit=6`, 0),
    apiServer<Page<Sponsorship>>("/v1/me/sponsorships?limit=8", 0),
    apiServer<Page<Notification>>("/v1/me/notifications?limit=8", 0),
  ]);

  const unread = (notifications?.items ?? []).filter((item) => !item.readAt).length;

  return (
    <Container width="wide" className="py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={me.displayName} src={me.avatarUrl} size={52} />
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{me.displayName}</h1>
            <p className="text-[13px] text-fg-subtle">
              <Link href={`/creator/${me.handle}`} className="hover:text-fg">
                @{me.handle}
              </Link>
              {!me.primaryWallet ? (
                <>
                  <span aria-hidden> · </span>
                  <Link href="/settings" className="text-accent hover:underline">
                    Connect a wallet to receive sponsorships
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/settings" variant="secondary">
            Settings
          </ButtonLink>
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            Publish
          </ButtonLink>
        </div>
      </header>

      <Card className="mb-10 grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
        <Stat label="Sessions" value={formatCount(me.videoCount)} />
        <Stat label="Followers" value={formatCount(me.followerCount)} />
        <Stat label="Earned" value={formatSol(me.sponsorTotalLamports)} hint="confirmed on chain" />
        <Stat label="Unread" value={String(unread)} hint="notifications" />
      </Card>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="your-sessions">
          <div className="mb-5 flex items-end justify-between">
            <h2 id="your-sessions" className="text-[17px] font-semibold">
              Your sessions
            </h2>
            <Link
              href={`/creator/${me.handle}`}
              className="text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              View profile
            </Link>
          </div>

          {videos && videos.items.length > 0 ? (
            <VideoGrid videos={videos.items} />
          ) : (
            <Card>
              <EmptyState
                icon={<UploadIcon size={24} />}
                title="Publish your first session"
                description="Record what you are working on, upload the timelapse, and the record starts building itself."
                action={<ButtonLink href="/upload">Upload a session</ButtonLink>}
              />
            </Card>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Recent sponsorships</h2>
            {sponsorships && sponsorships.items.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {sponsorships.items.map((sponsorship) => (
                  <li key={sponsorship.id} className="flex items-start gap-3">
                    <Avatar
                      name={sponsorship.sponsor?.displayName ?? "Anonymous"}
                      src={sponsorship.sponsor?.avatarUrl}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium">
                          {sponsorship.sponsor?.displayName ?? "Anonymous"}
                        </span>
                        <span className="shrink-0 tabular-nums text-accent">
                          {formatSol(sponsorship.amount)}
                        </span>
                      </p>
                      {sponsorship.message ? (
                        <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                          {sponsorship.message}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[12px] text-fg-subtle">
                        {timeAgo(sponsorship.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
                Nothing yet. Sponsorships land here the moment they settle on chain.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Notifications</h2>
              {unread > 0 ? <Badge tone="accent">{unread} new</Badge> : null}
            </div>
            {notifications && notifications.items.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {notifications.items.map((item) => (
                  <li key={item.id} className="flex gap-2.5 text-[13px]">
                    <BellIcon size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                    <div>
                      <p className="text-fg">{describeNotification(item)}</p>
                      <p className="text-[12px] text-fg-subtle">{timeAgo(item.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-fg-muted">Nothing to catch up on.</p>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  );
}

/** Notification payloads are data, so they are described, never rendered raw. */
function describeNotification(notification: Notification): string {
  switch (notification.kind) {
    case "new_sponsor":
      return "Someone sponsored your work.";
    case "new_comment":
      return "New comment on one of your sessions.";
    case "comment_reply":
      return "Someone replied to your comment.";
    case "new_follower":
      return "You have a new follower.";
    case "application_update":
      return "An application you sent changed status.";
    case "engagement_update":
      return "An engagement you are part of was updated.";
    case "moderation_notice":
      return "A moderator took action on your content.";
    case "payout":
      return "A payout was released to your wallet.";
    default:
      return "Something happened on your account.";
  }
}
