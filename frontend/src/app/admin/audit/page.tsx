import { getAdmin } from "@/lib/data";
import { AuditLog } from "@/components/admin/audit-log";
import { AdminPage } from "@/components/admin/console";

export const metadata = { title: "Audit trail" };

export default async function AuditPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <AdminPage
      title="Audit trail"
      description="Append-only. Every decision that changes what the public sees, who took it, and when."
    >
      <AuditLog entries={data.audit} />
    </AdminPage>
  );
}
