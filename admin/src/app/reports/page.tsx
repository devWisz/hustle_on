import { apiServer } from "@/lib/api";
import type { Page, Report } from "@/lib/types";
import { AccessDenied, Card } from "@/components/ui";
import { ReportQueue } from "@/components/report-queue";

export const dynamic = "force-dynamic";

interface Me {
  role: "member" | "moderator" | "admin";
}

export default async function ReportsPage() {
  const [{ data, status }, me] = await Promise.all([
    apiServer<Page<Report>>("/v1/admin/reports?limit=100"),
    apiServer<Me>("/v1/me"),
  ]);

  if (!data) return <AccessDenied status={status} />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Reports</h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">
        Oldest first. Acting on a report applies the decision and records it in one transaction.
      </p>

      {data.items.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm font-medium">The queue is empty</p>
          <p className="mt-1.5 text-[13px] text-fg-muted">Nothing is waiting for review.</p>
        </Card>
      ) : (
        <ReportQueue reports={data.items} isAdmin={me.data?.role === "admin"} />
      )}
    </div>
  );
}
