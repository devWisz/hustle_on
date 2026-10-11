import { getAdmin } from "@/lib/data";
import { AdminPage } from "@/components/admin/console";
import { Library } from "@/components/admin/library";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <AdminPage
      title="Library"
      description="Everything currently on the public feed. A takedown removes it immediately and is written to the audit trail."
    >
      <Library initial={data.library} />
    </AdminPage>
  );
}
