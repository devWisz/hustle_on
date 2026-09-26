import { getAdmin } from "@/lib/data";
import { AdminHeader } from "@/components/admin/page-header";
import { ReviewDesk } from "@/components/admin/review-desk";
import { Card } from "@/components/ui";

export const metadata = { title: "Review desk" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [data, { item }] = await Promise.all([getAdmin(), searchParams]);
  if (typeof data === "string") return null;

  return (
    <div>
      <AdminHeader
        title="Review desk"
        description="Nothing reaches the feed without a decision here. Read the write-up against the recording, then decide."
      />
      <div className="mt-6">
        {data.queueFailed ? (
          <Card className="p-8 text-center">
            <h2 className="text-[15px] font-semibold">The queue could not be loaded</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">
              The API did not answer. This is not an empty queue, so do not assume every submission
              has been decided.
            </p>
          </Card>
        ) : (
          <ReviewDesk initial={data.queue} demo={data.demo} initialId={item} />
        )}
      </div>
    </div>
  );
}
