import { apiServer } from "@/lib/api";
import type { AdminVideo, Page } from "@/lib/types";
import { AccessDenied, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = new URLSearchParams({ limit: "80" });
  if (q) query.set("q", q);

  const { data, status } = await apiServer<Page<AdminVideo>>(`/v1/admin/videos?${query}`);
  if (!data) return <AccessDenied status={status} />;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Sessions</h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">
        Drafts and published work, newest first. Search by title or creator handle.
      </p>

      <form action="/videos" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search sessions"
          aria-label="Search sessions"
          className="h-10 w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
        />
      </form>

      {data.items.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm font-medium">No sessions match that</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-border bg-surface text-[12px] text-fg-subtle">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Creator</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Views</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((video) => (
                <tr key={video.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{video.title}</p>
                    <p className="font-mono text-[12px] text-fg-subtle">{video.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">@{video.creator.handle}</td>
                  <td className="px-4 py-3">
                    <Badge tone={video.status === "published" ? "neutral" : "danger"}>
                      {video.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{video.viewCount}</td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {new Date(video.createdAt).toLocaleDateString()}
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
