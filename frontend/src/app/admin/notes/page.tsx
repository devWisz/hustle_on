import { getAdmin } from "@/lib/data";
import { NotesModeration } from "@/components/admin/notes-moderation";
import { AdminHeader } from "@/components/admin/page-header";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader
        title="Notes"
        description="Everything people have written on published sessions, newest first. Removing a note is recorded in the audit trail."
      />
      <div className="mt-6">
        <NotesModeration initial={data.notes} />
      </div>
    </div>
  );
}
