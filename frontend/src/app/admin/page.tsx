import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser, Timelapse } from "@/lib/types";
import { ReviewQueue } from "@/components/review-queue";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Review", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  if (!me) redirect("/login?next=/admin");
  // A member who finds this URL gets the same answer as a stranger: there is
  // nothing here. A 403 would confirm the page exists.
  if (me.role !== "admin") notFound();

  const queue = await apiServer<{ items: Timelapse[] }>("/v1/admin/queue", 0);

  return (
    <Container width="wide" className="py-12">
      <h1 className="text-[26px] font-semibold leading-tight">Review queue</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Nothing reaches the feed without a decision here. Oldest submission first.
      </p>
      <div className="mt-8">
        <ReviewQueue initial={queue?.items ?? []} />
      </div>
    </Container>
  );
}
