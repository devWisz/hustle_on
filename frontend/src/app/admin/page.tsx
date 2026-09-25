import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { AuditEntry, SelfUser, Timelapse } from "@/lib/types";
import { ReviewQueue } from "@/components/review-queue";
import { AuditLog } from "@/components/audit-log";
import { Card, Container, SectionHeading } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Review", robots: { index: false, follow: false } };

// The queue and the audit trail are per-operator and change on every decision,
// so nothing on this page may be cached or reused for another request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  if (!me) redirect("/login?next=/admin");
  // A member who finds this URL gets the same answer as a stranger: there is
  // nothing here. A 403 would confirm the page exists.
  //
  // This is a rendering decision, not the authorisation. Every endpoint this
  // page reads is gated on the admin role server-side, so a forged session that
  // reached this far would still be handed nothing.
  if (me.role !== "admin") notFound();

  const [queue, audit] = await Promise.all([
    apiServer<{ items: Timelapse[] }>("/v1/admin/queue", 0),
    apiServer<{ items: AuditEntry[] }>("/v1/admin/audit?limit=25", 0),
  ]);

  // A failed read is not an empty queue. Saying "everything has been decided"
  // when the API is unreachable is the one thing this page must never do.
  const queueFailed = queue === null;

  return (
    <Container width="wide" className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Operator</p>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
            Review queue
          </h1>
          <p className="mt-1.5 max-w-prose text-sm text-fg-muted">
            Nothing reaches the feed without a decision here. Oldest submission first.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
          <ShieldIcon size={13} />
          Signed in as {me.displayName} · every decision is recorded
        </p>
      </div>

      <div className="mt-8">
        {queueFailed ? (
          <Card className="p-8 text-center">
            <h2 className="text-[15px] font-medium">The queue could not be loaded</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">
              The API did not answer. This is not an empty queue — do not assume every submission
              has been decided. Reload the page to try again.
            </p>
          </Card>
        ) : (
          <ReviewQueue initial={queue.items} />
        )}
      </div>

      <section className="mt-14">
        <SectionHeading
          title="Recent decisions"
          description="Most recent first. This trail is append-only and cannot be edited from here."
        />
        <AuditLog entries={audit?.items ?? []} />
      </section>
    </Container>
  );
}
