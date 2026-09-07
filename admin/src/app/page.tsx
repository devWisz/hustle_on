import { apiServer } from "@/lib/api";
import type { PlatformStats } from "@/lib/types";
import { AccessDenied, Card, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

function formatSol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(2)} SOL`;
}

export default async function OverviewPage() {
  const { data, status } = await apiServer<PlatformStats>("/v1/admin/stats");
  if (!data) return <AccessDenied status={status} />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Overview</h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">Live figures, read straight from the database.</p>

      <Card className="mt-6 grid grid-cols-2 gap-6 p-6 sm:grid-cols-3">
        <Stat label="Active accounts" value={data.users.toLocaleString()} />
        <Stat label="Published sessions" value={data.publishedVideos.toLocaleString()} />
        <Stat label="Open roles" value={data.openJobs.toLocaleString()} />
        <Stat label="Confirmed sponsorships" value={data.confirmedSponsorships.toLocaleString()} />
        <Stat label="Total sponsored" value={formatSol(data.sponsorTotalLamports)} />
        <Stat label="Open reports" value={data.openReports.toLocaleString()} />
      </Card>

      {data.openReports > 0 ? (
        <Card className="mt-5 p-5">
          <p className="text-sm">
            <span className="font-medium">{data.openReports}</span> report
            {data.openReports === 1 ? "" : "s"} waiting for review.{" "}
            <a href="/reports" className="font-medium underline underline-offset-4">
              Open the queue
            </a>
          </p>
        </Card>
      ) : null}
    </div>
  );
}
