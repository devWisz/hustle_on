import { getAdmin } from "@/lib/data";
import { FrontPage } from "@/components/admin/front-page";
import { AdminHeader } from "@/components/admin/page-header";

export const metadata = { title: "Front page" };

export default async function FrontPagePage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader
        title="Front page"
        description="The first sessions a visitor sees, in the order they appear. It is capped so it stays a selection rather than the whole library, and every change to it is written to the audit trail."
      />
      <div className="mt-6">
        <FrontPage initial={data.shelf} capacity={data.shelfCapacity} library={data.library} />
      </div>
    </div>
  );
}
