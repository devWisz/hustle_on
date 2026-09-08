import { apiServer } from "@/lib/api";
import type { AdminJob, Page } from "@/lib/types";
import { AccessDenied, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = new URLSearchParams({ limit: "80" });
  if (q) query.set("q", q);

  const { data, status } = await apiServer<Page<AdminJob>>(`/v1/admin/jobs?${query}`);
  if (!data) return <AccessDenied status={status} />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Roles</h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">
        Open, draft, and closed roles from the jobs table.
      </p>

      <form action="/jobs" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search roles"
          aria-label="Search roles"
          className="h-10 w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
        />
      </form>

      {data.items.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm font-medium">No roles match that</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-border bg-surface text-[12px] text-fg-subtle">
              <tr>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Applicants</th>
                <th className="px-4 py-2.5 font-medium">Posted</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{job.title}</td>
                  <td className="px-4 py-3 text-fg-muted">@{job.client.handle}</td>
                  <td className="px-4 py-3">
                    <Badge>{job.status}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{job.applicationCount}</td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {new Date(job.createdAt).toLocaleDateString()}
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
