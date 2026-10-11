import { getAdmin } from "@/lib/data";
import { AdminPage } from "@/components/admin/console";
import { NotesModeration } from "@/components/admin/notes-moderation";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <AdminPage
      title="Notes"
      description="Everything people have written on published sessions, newest first. Removing a note is recorded in the audit trail."
    >
      <NotesModeration initial={data.notes} initialCursor={data.notesCursor} />
    </AdminPage>
  );
}
