import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Page, Video } from "@/lib/types";
import { VideoGrid } from "@/components/video-card";
import { ButtonLink, Card, Container, EmptyState } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Discover",
  description: "Timelapses of real work sessions, newest first.",
};

export const revalidate = 30;

const TAGS = ["rust", "design", "frontend", "databases", "ml", "hardware", "writing"] as const;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: "24" });
  if (params.tag) query.set("tag", params.tag);
  if (params.q) query.set("q", params.q);
  if (params.cursor) query.set("cursor", params.cursor);

  const feed = await apiServer<Page<Video>>(`/v1/feed?${query.toString()}`);
  const videos = feed?.items ?? [];

  return (
    <Container width="wide" className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Discover</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Every session published here is someone&apos;s actual working time, compressed.
        </p>
      </header>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* A plain GET form: filtering works with JavaScript unavailable, and
            each result set has its own shareable URL. */}
        <form action="/discover" className="relative w-full sm:max-w-xs">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search sessions"
            aria-label="Search sessions"
            className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface pl-9 pr-3
                       text-sm placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent"
          />
          {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
        </form>

        <nav aria-label="Filter by tag" className="scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
          <TagPill href="/discover" label="All" active={!params.tag} />
          {TAGS.map((tag) => (
            <TagPill key={tag} href={`/discover?tag=${tag}`} label={tag} active={params.tag === tag} />
          ))}
        </nav>
      </div>

      {videos.length > 0 ? (
        <>
          <VideoGrid videos={videos} />
          {feed?.nextCursor ? (
            <div className="mt-12 flex justify-center">
              <ButtonLink
                variant="secondary"
                href={{ pathname: "/discover", query: { ...params, cursor: feed.nextCursor } }}
              >
                Load older sessions
              </ButtonLink>
            </div>
          ) : null}
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<SearchIcon size={26} />}
            title="No sessions match that"
            description="Try a different tag, or clear the search to see everything that has been published."
            action={
              <ButtonLink href="/discover" variant="secondary">
                Clear filters
              </ButtonLink>
            }
          />
        </Card>
      )}
    </Container>
  );
}

function TagPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors " +
        (active
          ? "border-transparent bg-fg text-bg"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg")
      }
    >
      {label}
    </Link>
  );
}
