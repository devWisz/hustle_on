import { apiServer } from "@/lib/api";
import type { AdminHealth, Page, PlatformStats, Report } from "@/lib/types";
import { AccessDenied, Card, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatSol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(2)} SOL`;
}

export default async function OverviewPage() {
  const [statsRes, healthRes, reportsRes] = await Promise.all([
    apiServer<PlatformStats>("/v1/admin/stats"),
    apiServer<AdminHealth>("/v1/admin/health"),
    apiServer<Page<Report>>("/v1/admin/reports?limit=5"),
  ]);

  if (!statsRes.data) return <AccessDenied status={statsRes.status} />;

  const data = statsRes.data;
  const health = healthRes.data;
  const reports = reportsRes.data?.items ?? [];
  const dbOk = health?.database === "connected";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Overview</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            Live figures, read straight from Postgres.
          </p>
        </div>
        <p
          className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
            dbOk
              ? "border-accent/30 bg-accent-soft text-accent"
              : "border-danger/30 bg-danger-soft text-danger"
          }`}
        >
          {health
            ? dbOk
              ? `Database connected · ${health.latencyMs}ms`
              : "Database unreachable"
            : "API unreachable"}
        </p>
      </div>

      <Card className="mt-6 grid grid-cols-2 gap-6 p-6 sm:grid-cols-3">
        <Stat label="Active accounts" value={data.users.toLocaleString()} />
        <Stat label="Published sessions" value={data.publishedVideos.toLocaleString()} />
        <Stat label="Open roles" value={data.openJobs.toLocaleString()} />
        <Stat label="Confirmed sponsorships" value={data.confirmedSponsorships.toLocaleString()} />
        <Stat label="Total sponsored" value={formatSol(data.sponsorTotalLamports)} />
        <Stat label="Open reports" value={data.openReports.toLocaleString()} />
      </Card>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Moderation queue</h2>
            <a href="/reports" className="text-[13px] text-fg-muted underline underline-offset-4">
              Open queue
            </a>
          </div>
          {reports.length === 0 ? (
            <p className="mt-4 text-[13px] text-fg-muted">Nothing waiting for review.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {report.reason.replace(/_/g, " ")} · {report.subjectType}
                    </p>
                    <p className="text-[12px] text-fg-subtle">
                      {report.reporter ? `@${report.reporter.handle}` : "removed account"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-fg-subtle">
                    {report.reportCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Operator shortcuts</h2>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li>
              <a href="/users" className="text-fg-muted underline underline-offset-4 hover:text-fg">
                Browse accounts
              </a>
            </li>
            <li>
              <a href="/videos" className="text-fg-muted underline underline-offset-4 hover:text-fg">
                Review sessions
              </a>
            </li>
            <li>
              <a href="/jobs" className="text-fg-muted underline underline-offset-4 hover:text-fg">
                Inspect roles
              </a>
            </li>
          </ul>
          {health ? (
            <p className="mt-6 text-[12px] leading-relaxed text-fg-subtle">
              Runtime {health.env} on {health.cluster}. Ping currently {health.latencyMs}ms.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
