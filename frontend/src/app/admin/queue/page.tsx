import { getAdmin } from "@/lib/data";
import { AdminPage, Panel } from "@/components/admin/console";
import { ReviewDesk } from "@/components/admin/review-desk";

export const metadata = { title: "Review desk" };

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const [data, { item }] = await Promise.all([getAdmin(), searchParams]);
  if (typeof data === "string") return null;

  return (
    <AdminPage
      title="Review desk"
      description="Nothing reaches the feed without a decision here. Read the write-up against the recording, then decide."
    >
      {data.queueFailed ? (
        <Panel padded className="text-center">
          <h2 className="text-[15px] font-semibold">The queue could not be loaded</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">
            The API did not answer. This is not an empty queue, so do not assume every submission
            has been decided.
          </p>
        </Panel>
      ) : (
        // Each submission arrives with the record of the person who made it, so the
        // desk can show a creator's history without asking the API for anything else.
        <ReviewDesk initial={data.queue} initialId={item} members={data.members} />
      )}
    </AdminPage>
  );
}
