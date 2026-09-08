import { apiServer } from "@/lib/api";
import type { AdminUser, Page } from "@/lib/types";
import { AccessDenied, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = new URLSearchParams({ limit: "80" });
  if (q) query.set("q", q);

  const { data, status } = await apiServer<Page<AdminUser>>(`/v1/admin/users?${query}`);
  if (!data) return <AccessDenied status={status} />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Accounts</h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">
        Every row is a user in Postgres. Search by handle, name, or email.
      </p>

      <form action="/users" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search accounts"
          aria-label="Search accounts"
          className="h-10 w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
        />
      </form>

      {data.items.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm font-medium">No accounts match that</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-border bg-surface text-[12px] text-fg-subtle">
              <tr>
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sessions</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-[12px] text-fg-subtle">@{user.handle}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.status === "active" ? "neutral" : "danger"}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{user.videoCount}</td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
