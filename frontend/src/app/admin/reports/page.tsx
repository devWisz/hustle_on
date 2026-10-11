import { getAdmin } from "@/lib/data";
import { AdminPage } from "@/components/admin/console";
import { ReportsInbox } from "@/components/admin/reports-inbox";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <AdminPage
      title="Reports"
      description="Sessions and notes people have flagged. Closing a report, and anything you remove because of it, is recorded in the audit trail."
    >
      <ReportsInbox initial={data.reports} initialCursor={data.reportsCursor} />
    </AdminPage>
  );
}
