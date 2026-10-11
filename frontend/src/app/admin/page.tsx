import Link from "next/link";
import { getAdmin } from "@/lib/data";
import { formatSol, timeAgo } from "@/lib/format";
import { formatWait, waitingMinutes } from "@/lib/review";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AuditRow, DECISION_ACTIONS } from "@/components/admin/audit-log";
import { AdminPage, Panel, StatCard, decisionTotals } from "@/components/admin/console";
import { CountUp } from "@/components/motion/count-up";
import { Avatar, EmptyState } from "@/components/ui";
import { InboxIcon } from "@/components/ui/icons";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const data = await getAdmin();
  if (typeof data === "string") return null;

  const { approved, decisions } = decisionTotals(data.activity);
  const approvalRate = decisions ? Math.round((approved / decisions) * 100) : 0;

  const waiting = [...data.queue].sort((a, b) => waitingMinutes(b) - waitingMinutes(a));
  const oldest = waiting[0];
  const openReports = data.reports
    .filter((r) => r.status === "open")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const inFlight = data.ledger.filter((e) => e.status === "pending" || e.status === "submitted");
  const decisionRows = data.audit.filter((e) => DECISION_ACTIONS.includes(e.action));
  const earners = [...data.members]
    .sort((a, b) => b.donationTotalLamports - a.donationTotalLamports)
    .slice(0, 5)
    .filter((m) => m.donationTotalLamports > 0);

  return (
    <AdminPage
      title={`Welcome back, ${data.operator.displayName.split(" ")[0]}`}
      description="What needs you right now, and what the last thirty days looked like. Every number opens the page that acts on it."
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Submissions waiting"
          value={<CountUp value={data.queue.length} format="plain" />}
          hint={oldest ? `Oldest has waited ${formatWait(waitingMinutes(oldest))}` : "Queue is clear"}
          href="/admin/queue"
          cta="Open the review desk"
        />
        <StatCard
          label="Open reports"
          value={<CountUp value={openReports.length} format="plain" />}
          hint={
            openReports.length
              ? `Oldest ${timeAgo(openReports[0]?.createdAt ?? "")}`
              : "Nothing flagged"
          }
          href="/admin/reports"
          cta="Open the reports inbox"
        />
        <StatCard
          label="Donations awaiting the chain"
          value={
            inFlight.length ? (
              <CountUp value={inFlight.reduce((n, e) => n + e.amountLamports, 0)} format="sol" />
            ) : (
              "0 SOL"
            )
          }
          hint={
            inFlight.length
              ? `${inFlight.length} transfer${inFlight.length === 1 ? "" : "s"} not yet confirmed`
              : "Nothing is in flight"
          }
          href="/admin/ledger"
          cta="Open the ledger"
        />
        <StatCard
          label="Decisions · 30 days"
          value={<CountUp value={decisions} format="plain" />}
          hint={
            decisions ? `${approvalRate}% approved, ${decisions - approved} sent back` : "No decisions yet"
          }
          href="/admin/audit"
          cta="Open the audit trail"
        />
      </dl>

      <Panel padded>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Review decisions · last 30 days</h2>
          <Link
            href="/admin/audit"
            className="link-underline text-[13px] text-fg-muted hover:text-fg"
          >
            Audit trail
          </Link>
        </div>
        <div className="mt-5">
          {data.activity.length ? (
            <ActivityChart days={data.activity} />
          ) : (
            <p className="text-[13.5px] text-fg-muted">
              Activity could not be loaded. Reload to try again.
            </p>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel padded className="h-full">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Waiting longest</h2>
            <Link
              href="/admin/queue"
              className="link-underline text-[13px] text-fg-muted hover:text-fg"
            >
              All {data.queue.length}
            </Link>
          </div>
          {waiting.length === 0 ? (
            <EmptyState
              className="mt-5"
              icon={<InboxIcon size={18} />}
              title="The queue is clear"
              description="Every submission has a decision. New ones appear here as they arrive."
            />
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {waiting.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/queue?item=${encodeURIComponent(t.id)}`}
                    className="group -mx-2 flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-3 hover:bg-surface-raised"
                  >
                    <Avatar name={t.creator.displayName} src={t.creator.avatarUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-fg-subtle">
                        {t.creator.displayName} · waiting {formatWait(waitingMinutes(t))}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-fg-subtle group-hover:text-fg">
                      Decide
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel padded className="h-full">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Recent decisions</h2>
            <Link
              href="/admin/audit"
              className="link-underline text-[13px] text-fg-muted hover:text-fg"
            >
              Audit trail
            </Link>
          </div>
          {decisionRows.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-fg-muted">
              No approvals or rejections recorded yet. They appear here the moment you make one.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {decisionRows.slice(0, 5).map((entry) => (
                <AuditRow key={entry.id} entry={entry} compact />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {earners.length > 0 ? (
        <Panel padded>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Top creators by sponsorship</h2>
            <Link
              href="/admin/members"
              className="link-underline text-[13px] text-fg-muted hover:text-fg"
            >
              All members
            </Link>
          </div>
          <ol className="mt-4 space-y-3">
            {earners.map((m, i) => {
              const share = earners[0]?.donationTotalLamports
                ? m.donationTotalLamports / earners[0].donationTotalLamports
                : 0;
              return (
                <li
                  key={m.id}
                  className="grid grid-cols-[20px_minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3 text-[13.5px]"
                >
                  <span className="font-mono text-[11.5px] text-fg-subtle">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={m.displayName} src={m.avatarUrl} size={24} />
                    <span className="truncate">{m.displayName}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-raised">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${share * 100}%`, background: "var(--chart-1)" }}
                    />
                  </span>
                  <span className="font-mono text-[12.5px] tabular-nums">
                    {formatSol(m.donationTotalLamports)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}
    </AdminPage>
  );
}
