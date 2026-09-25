import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Donation, SelfUser, Timelapse } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { SAMPLE_RECEIVED, SAMPLE_SELF, SAMPLE_SUBMISSIONS } from "@/lib/sample";
import { formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { SavedList } from "@/components/saved-list";
import { GuestGate, SampleNote } from "@/components/guest";
import {
  ButtonLink,
  Card,
  Container,
  EmptyState,
  GlassStat,
  SectionHeading,
} from "@/components/ui";
import {
  ClockIcon,
  EyeIcon,
  TrendingIcon,
  UploadIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/icons";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);

  // A guest gets the same screen built from sample records. It is the one page
  // that explains what the product does for a creator, so sending somebody to
  // a sign-in form to find out is the wrong order.
  if (!me) {
    if (await isGuestPreview()) {
      return (
        <DashboardView
          me={SAMPLE_SELF}
          items={SAMPLE_SUBMISSIONS}
          donations={SAMPLE_RECEIVED}
          sample
        />
      );
    }
    redirect("/login?next=/dashboard");
  }

  const [mine, received] = await Promise.all([
    apiServer<{ items: Timelapse[] }>("/v1/me/timelapses", 0),
    apiServer<{ items: Donation[] }>("/v1/me/donations", 0),
  ]);

  return <DashboardView me={me} items={mine?.items ?? []} donations={received?.items ?? []} />;
}

function DashboardView({
  me,
  items,
  donations,
  sample = false,
}: {
  me: SelfUser;
  items: Timelapse[];
  donations: Donation[];
  sample?: boolean;
}) {
  return (
    <Container className="py-12">
      <div className="animate-fade-in-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Creator dashboard</p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">
            Your <span className="text-accent">work</span>
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {formatSol(me.donationTotalLamports)} received across {me.timelapseCount} published
            timelapse{me.timelapseCount === 1 ? "" : "s"}.
          </p>
        </div>
        {sample ? null : (
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            Upload a timelapse
          </ButtonLink>
        )}
      </div>

      {sample ? (
        <SampleNote className="mt-6">
          This is an invented account, so you can see what the screen looks like with work on it.
          Nothing here belongs to anybody and nothing you do is saved.
        </SampleNote>
      ) : null}

      <div className="stagger-children mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {sample ? (
        <GuestGate
          className="mt-8"
          title="This is where your own submissions would be"
          body="An account takes one email and one click on a link — there is no password and nothing to fill in afterwards. Your first upload goes to review the same day."
          next="/upload"
        />
      ) : !me.payoutVerified ? (
        <WalletPrompt />
      ) : null}

      {sample ? null : (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
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
      )}

      <section className="mt-10">
        <SectionHeading
          title="Submissions"
          description={
            sample
              ? "One published, one waiting, one declined — the three states a submission can be in."
              : undefined
          }
        />
        {items.length > 0 ? (
          <ul className="stagger-children space-y-3">
            {items.map((t) => (
              <SubmissionRow key={t.id} timelapse={t} linkable={!sample} />
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
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-4 py-3.5 transition-colors hover:bg-surface-raised/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
                    {d.message ? (
                      <p className="mt-0.5 text-[13px] text-fg-muted">{d.message}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-accent">
                      {formatSol(d.amountLamports)}
                    </p>
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

      {/* A preview has no saved list of its own; showing the visitor's local one
          next to an invented account would read as if it belonged to it. */}
      {sample ? null : (
        <section className="mt-12">
          <SectionHeading
            title="Saved"
            description="Timelapses you have bookmarked to come back to."
          />
          <SavedList />
        </section>
      )}
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
function SubmissionRow({ timelapse, linkable }: { timelapse: Timelapse; linkable: boolean }) {
  const t = timelapse;
  const href = linkable && t.status === "published" ? `/watch/${t.slug}` : null;
  return (
    <li>
      <Card className="card-hover p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium">
              {href ? (
                <Link href={href} className="transition-colors hover:text-accent">
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
            <p className="text-[12px] font-semibold uppercase tracking-wider text-danger">
              Why this was declined
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-danger">{t.reviewNote}</p>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

function WalletPrompt() {
  return (
    <Card
      className="card-hover mt-8 flex flex-wrap items-center justify-between gap-4 p-5"
      variant="glass"
    >
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
