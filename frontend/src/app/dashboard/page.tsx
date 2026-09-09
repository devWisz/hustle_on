import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Donation, SelfUser, Timelapse } from "@/lib/types";
import { formatSession, formatSol, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink, Card, Container, EmptyState, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  if (!me) redirect("/login?next=/dashboard");

  const [mine, received] = await Promise.all([
    apiServer<{ items: Timelapse[] }>("/v1/me/timelapses", 0),
    apiServer<{ items: Donation[] }>("/v1/me/donations", 0),
  ]);
  const items = mine?.items ?? [];
  const donations = received?.items ?? [];

  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight">Your work</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {formatSol(me.donationTotalLamports)} received across {me.timelapseCount} published
            timelapse{me.timelapseCount === 1 ? "" : "s"}.
          </p>
        </div>
        <ButtonLink href="/upload">Upload a timelapse</ButtonLink>
      </div>

      {!me.payoutVerified ? <WalletPrompt /> : null}

      <section className="mt-10">
        <SectionHeading title="Submissions" />
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((t) => (
              <SubmissionRow key={t.id} timelapse={t} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No submissions yet"
            description="Record a session, write down what you did, and send it in for review."
            action={<ButtonLink href="/upload">Upload a timelapse</ButtonLink>}
          />
        )}
      </section>

      {donations.length > 0 ? (
        <section className="mt-12">
          <SectionHeading title="Donations received" />
          <Card className="px-5">
            <ul className="divide-y divide-border">
              {donations.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
                    {d.message ? (
                      <p className="mt-0.5 text-[13px] text-fg-muted">{d.message}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums">{formatSol(d.amountLamports)}</p>
                    {d.confirmedAt ? (
                      <p className="text-[12px] text-fg-subtle">{timeAgo(d.confirmedAt)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Container>
  );
}

/**
 * One submission, with its decision.
 *
 * A rejection shows the reviewer's note in full. A creator who cannot see why
 * they were declined has no way to fix it, which is the whole point of asking
 * a reviewer to write one.
 */
function SubmissionRow({ timelapse }: { timelapse: Timelapse }) {
  const t = timelapse;
  const linkable = t.status === "published";
  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium">
              {linkable ? (
                <Link href={`/watch/${t.slug}`} className="transition-colors hover:text-accent">
                  {t.title}
                </Link>
              ) : (
                t.title
              )}
            </h3>
            <p className="mt-1 text-[13px] text-fg-muted">
              {t.sessionMinutes > 0 ? `${formatSession(t.sessionMinutes)} · ` : ""}
              {timeAgo(t.createdAt)}
              {t.donationTotalLamports > 0
                ? ` · ${formatSol(t.donationTotalLamports)} received`
                : ""}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </div>

        {t.status === "rejected" && t.reviewNote ? (
          <div className="mt-3 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5">
            <p className="text-[13px] leading-relaxed text-danger">{t.reviewNote}</p>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

function WalletPrompt() {
  return (
    <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <h2 className="text-[15px] font-semibold">No wallet on file</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Nobody can donate to your work until you verify a Solana address to receive it.
        </p>
      </div>
      <ButtonLink href="/settings" variant="secondary">
        Add a wallet
      </ButtonLink>
    </Card>
  );
}
