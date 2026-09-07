import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { Job, SelfUser } from "@/lib/types";
import { Avatar, Badge, Card, Container } from "@/components/ui";
import { ApplyForm } from "@/components/apply-form";
import { formatUsd, timeAgo } from "@/lib/format";

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

const engagementLabels: Record<Job["engagement"], string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  milestone: "Milestone escrow",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await apiServer<Job>(`/v1/jobs/${slug}`);
  return job
    ? { title: job.title, description: job.description.slice(0, 160) }
    : { title: "Role not found" };
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [job, session] = await Promise.all([
    apiServer<Job>(`/v1/jobs/${slug}`, 30),
    apiServer<SessionResponse>("/v1/auth/session", 0),
  ]);

  if (!job) notFound();
  const viewer = session?.authenticated ? session.user : undefined;
  const isClient = viewer?.id === job.client.id;

  return (
    <Container className="py-10 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-snug tracking-tight">{job.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
            <Avatar name={job.client.displayName} src={job.client.avatarUrl} size={22} />
            <Link href={`/creator/${job.client.handle}`} className="hover:text-fg">
              {job.client.displayName}
            </Link>
            {job.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>Posted {timeAgo(job.publishedAt)}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{job.applicationCount} applied</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {job.isRemote ? <Badge tone="accent">Remote</Badge> : null}
            {job.location ? <Badge>{job.location}</Badge> : null}
            <Badge>{engagementLabels[job.engagement]}</Badge>
            {job.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>

          <div className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-muted">
            {job.description}
          </div>

          {isClient ? (
            <Card className="mt-10 p-5">
              <h2 className="text-[15px] font-semibold">You posted this role</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
                Applications are private to you. Review them, shortlist, and open a funded
                engagement with whoever you pick.
              </p>
            </Card>
          ) : (
            <ApplyForm slug={job.slug} signedIn={Boolean(viewer)} className="mt-10" />
          )}
        </article>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Terms</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[13px] text-fg-muted">Budget</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {job.budgetMinUsd && job.budgetMaxUsd
                    ? `${formatUsd(job.budgetMinUsd)} – ${formatUsd(job.budgetMaxUsd)}`
                    : "On request"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-muted">Structure</dt>
                <dd className="mt-0.5 font-medium">{engagementLabels[job.engagement]}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-muted">Payment</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                  Funds are escrowed on chain before work starts and released as milestones are
                  delivered.
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
