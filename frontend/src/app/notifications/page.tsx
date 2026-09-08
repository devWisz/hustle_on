import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Notification, Page, SelfUser } from "@/lib/types";
import { presentNotification } from "@/lib/notifications";
import { timeAgo } from "@/lib/format";
import { Card, Container, EmptyState } from "@/components/ui";
import { BellIcon } from "@/components/icons";
import { MarkAllRead } from "@/components/mark-all-read";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Sponsorships and application updates.",
  robots: { index: false, follow: false },
};

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export default async function NotificationsPage() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  if (!session?.authenticated) redirect("/login?next=/notifications");

  const page = await apiServer<Page<Notification>>(
    "/v1/me/notifications?limit=50",
    0,
  );
  const items = page?.items ?? [];
  const hasUnread = items.some((item) => !item.readAt);

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Sponsorships that settled and roles that moved forward.
          </p>
        </div>
        {hasUnread ? <MarkAllRead /> : null}
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellIcon size={26} />}
            title="Nothing here yet"
            description="When someone sponsors a session or a client responds to an application, it shows up on this page."
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {items.map((item) => {
              const view = presentNotification(item);
              const body = (
                <div className="flex items-start gap-3.5">
                  {/* An unread marker rather than a filled row: the row itself
                      stays legible against both surfaces. */}
                  <span
                    aria-hidden
                    className={
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                      (item.readAt ? "bg-transparent" : "bg-accent")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{view.title}</p>
                    {view.detail ? (
                      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                        {view.detail}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[12px] text-fg-subtle">
                      <time dateTime={item.createdAt}>
                        {timeAgo(item.createdAt)}
                      </time>
                      {item.readAt ? null : (
                        <span className="sr-only"> (unread)</span>
                      )}
                    </p>
                  </div>
                </div>
              );

              return (
                <li
                  key={item.id}
                  className="border-b border-border last:border-0"
                >
                  {view.href ? (
                    <Link
                      href={view.href}
                      className="block px-5 py-4 transition-colors hover:bg-surface-raised"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Container>
  );
}
