import { getAdmin } from "@/lib/data";
import { AdminHeader } from "@/components/admin/page-header";
import { ReportsInbox } from "@/components/admin/reports-inbox";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader
        title="Reports"
        description="Sessions and notes people have flagged. Closing a report, and anything you remove because of it, is recorded in the audit trail."
      />
      <div className="mt-6">
        <ReportsInbox initial={data.reports} />
      </div>
    </div>
  );
}
