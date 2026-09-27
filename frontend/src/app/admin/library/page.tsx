import { getAdmin } from "@/lib/data";
import { Library } from "@/components/admin/library";
import { AdminHeader } from "@/components/admin/page-header";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader
        title="Library"
        description="Everything currently on the public feed. A takedown removes it immediately and is written to the audit trail."
      />
      <div className="mt-6">
        <Library initial={data.library} />
      </div>
    </div>
  );
}
