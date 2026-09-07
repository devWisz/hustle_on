import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Job, Page } from "@/lib/types";
import { Avatar, Badge, ButtonLink, Card, Container, EmptyState } from "@/components/ui";
import { BriefcaseIcon } from "@/components/icons";
import { formatUsd, timeAgo } from "@/lib/format";

export const metadata: Metadata = {
  title: "Open roles",
  description: "Roles from clients who pay through escrow.",
};

export const revalidate = 60;

const engagementLabels: Record<Job["engagement"], string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  milestone: "Milestone escrow",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ skills?: string; q?: string; remote?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: "24" });
  if (params.skills) query.set("skills", params.skills);
  if (params.q) query.set("q", params.q);
  if (params.remote) query.set("remote", params.remote);

  const result = await apiServer<Page<Job>>(`/v1/jobs?${query.toString()}`);
  const jobs = result?.items ?? [];

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-[28px] font-semibold tracking-tight">Open roles</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
            Every engagement opened here is funded up front and released against delivered work.
          </p>
        </div>
        <ButtonLink href="/jobs/new" variant="secondary">
          Post a role
        </ButtonLink>
      </header>

      {jobs.length > 0 ? (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <Card as="li" key={job.id} className="p-6 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold leading-snug">
                    <Link href={`/jobs/${job.slug}`} className="hover:text-accent">
                      {job.title}
                    </Link>
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted">
                    <Avatar name={job.client.displayName} src={job.client.avatarUrl} size={20} />
                    <Link href={`/creator/${job.client.handle}`} className="hover:text-fg">
                      {job.client.displayName}
                    </Link>
                    {job.publishedAt ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(job.publishedAt)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">
                    {job.budgetMinUsd && job.budgetMaxUsd
                      ? `${formatUsd(job.budgetMinUsd)} – ${formatUsd(job.budgetMaxUsd)}`
                      : "Budget on request"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-subtle">
                    {engagementLabels[job.engagement]}
                  </p>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                {job.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {job.isRemote ? <Badge tone="accent">Remote</Badge> : null}
                {job.location ? <Badge>{job.location}</Badge> : null}
                {job.skills.slice(0, 4).map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
                <span className="ml-auto text-[12px] text-fg-subtle">
                  {job.applicationCount} applied
                </span>
              </div>
            </Card>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<BriefcaseIcon size={26} />}
            title="No open roles right now"
            description="Roles appear here as clients post them. In the meantime you can browse people who are open to work."
            action={
              <ButtonLink href="/hire" variant="secondary">
                Browse talent
              </ButtonLink>
            }
          />
        </Card>
      )}
    </Container>
  );
}
