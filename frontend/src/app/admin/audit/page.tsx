import { getAdmin } from "@/lib/data";
import { AuditLog } from "@/components/admin/audit-log";
import { AdminHeader } from "@/components/admin/page-header";

export const metadata = { title: "Audit trail" };

export default async function AuditPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader
        title="Audit trail"
        description="Append-only. Every decision that changes what the public sees, who took it, and when."
      />
      <div className="mt-6">
        <AuditLog entries={data.audit} />
      </div>
    </div>
  );
}
