import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Page, PublicUser } from "@/lib/types";
import { Avatar, Badge, ButtonLink, Card, Container, EmptyState } from "@/components/ui";
import { SocialLinks } from "@/components/social-links";
import { UsersIcon } from "@/components/icons";
import { formatSol, formatUsd } from "@/lib/format";

export const metadata: Metadata = {
  title: "Hire",
  description: "Hire people whose work you can watch before you commit.",
};

export const revalidate = 60;

export default async function HirePage({
  searchParams,
}: {
  searchParams: Promise<{ skills?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: "24" });
  if (params.skills) query.set("skills", params.skills);
  if (params.q) query.set("q", params.q);

  const result = await apiServer<Page<PublicUser>>(`/v1/talent?${query.toString()}`);
  const people = result?.items ?? [];

  return (
    <Container width="wide" className="py-10 sm:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-[28px] font-semibold tracking-tight">Hire</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          Everyone here publishes their working sessions. Before you send a message you can watch
          how they think, how they debug, and how long the work actually takes them.
        </p>
      </header>

      <form action="/hire" className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search by name"
          aria-label="Search people"
          className="h-10 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3
                     text-sm placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent"
        />
        <input
          type="text"
          name="skills"
          defaultValue={params.skills ?? ""}
          placeholder="Skills, comma separated"
          aria-label="Filter by skills"
          className="h-10 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3
                     text-sm placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent"
        />
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-fg
                     transition-colors hover:bg-accent-hover"
        >
          Filter
        </button>
      </form>

      {people.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {people.map((person) => (
            <Card as="li" key={person.id} className="p-6">
              <div className="flex items-start gap-4">
                <Link href={`/creator/${person.handle}`}>
                  <Avatar name={person.displayName} src={person.avatarUrl} size={52} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold">
                        <Link href={`/creator/${person.handle}`} className="hover:text-accent">
                          {person.displayName}
                        </Link>
                      </h2>
                      <p className="truncate text-[13px] text-fg-subtle">@{person.handle}</p>
                    </div>
                    <Badge tone="accent">Open to work</Badge>
                  </div>

                  {person.headline ? (
                    <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                      {person.headline}
                    </p>
                  ) : null}

                  {person.skills.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {person.skills.slice(0, 5).map((skill) => (
                        <li key={skill}>
                          <Badge>{skill}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] text-fg-muted">
                      <span className="font-medium text-fg">
                        {person.hourlyRateUsd
                          ? `${formatUsd(person.hourlyRateUsd)}/hr`
                          : "Rate on request"}
                      </span>
                      <span aria-hidden> · </span>
                      {person.videoCount} sessions
                      {person.sponsorTotalLamports > 0
                        ? ` · ${formatSol(person.sponsorTotalLamports)} earned`
                        : ""}
                    </p>
                    <SocialLinks links={person.socialLinks} size={15} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<UsersIcon size={26} />}
            title="Nobody matches that yet"
            description="Try fewer skills, or post the role and let people apply to you instead."
            action={<ButtonLink href="/jobs/new">Post a role</ButtonLink>}
          />
        </Card>
      )}
    </Container>
  );
}
