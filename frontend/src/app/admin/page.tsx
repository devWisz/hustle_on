import Link from "next/link";
import { getAdmin } from "@/lib/data";
import { formatSol, timeAgo } from "@/lib/format";
import { formatWait, reviewFlags, waitingMinutes } from "@/lib/review";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AuditRow } from "@/components/admin/audit-log";
import { AdminHeader } from "@/components/admin/page-header";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { Avatar, Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { ArrowRightIcon, InboxIcon } from "@/components/ui/icons";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const data = await getAdmin();
  if (typeof data === "string") return null;

  const decided = data.activity.reduce((n, d) => n + d.approved + d.rejected, 0);
  const approved = data.activity.reduce((n, d) => n + d.approved, 0);
  const volume = data.activity.reduce((n, d) => n + d.lamports, 0);
  const oldest = [...data.queue].sort((a, b) => waitingMinutes(b) - waitingMinutes(a));
  const earners = [...data.members].sort((a, b) => b.donationTotalLamports - a.donationTotalLamports).slice(0, 5);

  const kpis = [
    { label: "Waiting for review", value: <CountUp value={data.queue.length} format="plain" />, hint: oldest[0] ? `Oldest ${formatWait(waitingMinutes(oldest[0]))}` : "Queue is clear" },
    { label: "Approval rate · 30d", value: decided ? <CountUp value={(approved / decided) * 100} format="percent" /> : "—", hint: `${decided} decisions` },
    { label: "Published sessions", value: <CountUp value={data.stats.publishedTimelapses} format="plain" />, hint: `${data.stats.creators} creators` },
    { label: "Sponsored · 30d", value: volume ? <CountUp value={volume} format="sol" /> : <CountUp value={data.stats.donationTotalLamports} format="sol" />, hint: `${data.stats.confirmedDonations} confirmed transfers` },
  ];

  return (
    <div>
      <AdminHeader
        title={`Welcome back, ${data.operator.displayName.split(" ")[0]}`}
        description="Everything that needs a decision, and what the last thirty days looked like."
        action={
          <ButtonLink href="/admin/queue">
            Open review desk
            <ArrowRightIcon size={15} className="nudge-icon" />
          </ButtonLink>
        }
      />

      <Reveal as="dl" stagger={0.06} immediate className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
            <dt className="text-[12.5px] text-fg-muted">{k.label}</dt>
            <dd className="tnum mt-3 text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] font-semibold leading-none tracking-tight">{k.value}</dd>
            <p className="mt-2 text-[12px] text-fg-subtle">{k.hint}</p>
          </div>
        ))}
      </Reveal>

      <Reveal className="mt-6">
        <Card className="p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">Review decisions · last 30 days</h2>
          <div className="mt-5">
            {data.activity.length ? (
              <ActivityChart days={data.activity} />
            ) : (
              <p className="text-[13.5px] text-fg-muted">The API does not publish daily activity yet.</p>
            )}
          </div>
        </Card>
      </Reveal>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Reveal>
          <Card className="h-full p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Needs attention</h2>
              <Link href="/admin/queue" className="link-underline text-[13px] text-fg-muted hover:text-fg">
                All {data.queue.length}
              </Link>
            </div>
            {oldest.length === 0 ? (
              <EmptyState className="mt-5" icon={<InboxIcon size={18} />} title="Queue is clear" description="Every submission has a decision." />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {oldest.slice(0, 4).map((t) => {
                  const flags = reviewFlags(t);
                  return (
                    <li key={t.id}>
                      <Link href={`/admin/queue?item=${t.id}`} className="group -mx-2 flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-3 hover:bg-surface-raised">
                        <Avatar name={t.creator.displayName} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{t.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-subtle">
                            {t.creator.displayName} · waiting {formatWait(waitingMinutes(t))}
                            {flags.slice(0, 1).map((f) => (
                              <Badge key={f.label} tone={f.tone} className="h-5 px-2 text-[11px]">
                                {f.label}
                              </Badge>
                            ))}
                          </p>
                        </div>
                        <ArrowRightIcon size={14} className="nudge-icon shrink-0 text-fg-subtle" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="h-full p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Recent decisions</h2>
              <Link href="/admin/audit" className="link-underline text-[13px] text-fg-muted hover:text-fg">
                Audit trail
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {data.audit.slice(0, 5).map((entry) => (
                <AuditRow key={entry.id} entry={entry} compact />
              ))}
            </ul>
            {data.audit.length === 0 ? <p className="mt-3 text-[13.5px] text-fg-muted">No decisions recorded yet.</p> : null}
          </Card>
        </Reveal>
      </div>

      {earners.length > 0 ? (
        <Reveal className="mt-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Top creators by sponsorship</h2>
              <Link href="/admin/members" className="link-underline text-[13px] text-fg-muted hover:text-fg">
                All members
              </Link>
            </div>
            <ol className="mt-4 space-y-3">
              {earners.map((m, i) => {
                const share = earners[0]!.donationTotalLamports ? m.donationTotalLamports / earners[0]!.donationTotalLamports : 0;
                return (
                  <li key={m.id} className="grid grid-cols-[20px_minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3 text-[13.5px]">
                    <span className="font-mono text-[11.5px] text-fg-subtle">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={m.displayName} size={24} />
                      <span className="truncate">{m.displayName}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-raised">
                      <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: "var(--chart-1)" }} />
                    </span>
                    <span className="font-mono text-[12.5px] tabular-nums">{formatSol(m.donationTotalLamports)}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-[12px] text-fg-subtle">Last activity {timeAgo(data.members[0]?.lastActiveAt ?? new Date().toISOString())}.</p>
          </Card>
        </Reveal>
      ) : null}
    </div>
  );
}
