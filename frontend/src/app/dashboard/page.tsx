import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Donation, SelfUser, Timelapse } from "@/lib/types";
import { formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink, Card, Container, EmptyState, GlassStat, SectionHeading } from "@/components/ui";
import { ClockIcon, EyeIcon, TrendingIcon, UploadIcon, WalletIcon, ZapIcon } from "@/components/icons";

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
      {/* Dashboard header */}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Your <span className="text-accent">work</span>
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {formatSol(me.donationTotalLamports)} received across {me.timelapseCount} published
            timelapse{me.timelapseCount === 1 ? "" : "s"}.
          </p>
        </div>
        <ButtonLink href="/upload">
          <UploadIcon size={16} />
          Upload a timelapse
        </ButtonLink>
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 stagger-children">
        <GlassStat
          label="Published"
          value={formatCount(me.timelapseCount)}
          icon={<EyeIcon size={18} />}
        />
        <GlassStat
          label="Donations"
          value={formatCount(me.donationCount)}
          icon={<TrendingIcon size={18} />}
        />
        <GlassStat
          label="Total received"
          value={formatSol(me.donationTotalLamports)}
          icon={<WalletIcon size={18} />}
        />
        <GlassStat
          label="Submissions"
          value={String(items.length)}
          icon={<ClockIcon size={18} />}
        />
      </div>

      {!me.payoutVerified ? <WalletPrompt /> : null}

      {/* Quick actions */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <ZapIcon size={16} className="text-accent" />
          <h2 className="text-[15px] font-semibold">Quick actions</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/upload" variant="secondary" size="sm">
            <UploadIcon size={14} />
            New upload
          </ButtonLink>
          <ButtonLink href="/settings" variant="secondary" size="sm">
            <WalletIcon size={14} />
            Wallet settings
          </ButtonLink>
          <ButtonLink href={`/creator/${me.handle}`} variant="secondary" size="sm">
            <EyeIcon size={14} />
            View profile
          </ButtonLink>
        </div>
      </section>

      {/* Submissions */}
      <section className="mt-10">
        <SectionHeading title="Submissions" />
        {items.length > 0 ? (
          <ul className="space-y-3 stagger-children">
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

      {/* Donations received */}
      {donations.length > 0 ? (
        <section className="mt-12">
          <SectionHeading title="Donations received" />
          <Card className="px-5">
            <ul className="divide-y divide-border">
              {donations.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 py-3.5 transition-colors hover:bg-surface-raised/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
                    {d.message ? (
                      <p className="mt-0.5 text-[13px] text-fg-muted">{d.message}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums font-medium text-accent">{formatSol(d.amountLamports)}</p>
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
      <Card className="p-4 card-hover">
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
    <Card className="card-hover mt-8 flex flex-wrap items-center justify-between gap-4 p-5" variant="glass">
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
