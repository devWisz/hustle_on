import { getAdmin } from "@/lib/data";
import { Members } from "@/components/admin/members";
import { AdminHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui";
import { UsersIcon } from "@/components/ui/icons";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;
  return (
    <div>
      <AdminHeader title="Members" description="Every account, its standing, and what it has published and raised." />
      <div className="mt-6">
        {data.members.length ? (
          <Members initial={data.members} demo={data.demo} />
        ) : (
          <EmptyState
            icon={<UsersIcon size={18} />}
            title="Member management is not in the API yet"
            description="Once the API exposes an admin members endpoint, accounts appear here with suspend and reinstate controls."
          />
        )}
      </div>
    </div>
  );
}
