import { Suspense } from "react";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Job, Page, PublicStats, PublicUser, Video } from "@/lib/types";
import { VideoGrid, VideoGridSkeleton } from "@/components/video-card";
import { Avatar, ButtonLink, Card, Container, EmptyState, SectionHeading } from "@/components/ui";
import { AnimatedStats } from "@/components/animated-stats";
import { HeroShowcase } from "@/components/hero-showcase";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CheckIcon,
  SearchIcon,
  ShieldIcon,
  UploadIcon,
} from "@/components/icons";
import { formatSol, formatUsd, timeAgo } from "@/lib/format";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<StatsStripSkeleton />}>
        <LiveStats />
      </Suspense>
      <HowItWorks />
      <Suspense fallback={<SessionsSkeleton />}>
        <LatestSessions />
      </Suspense>
      <Suspense fallback={null}>
        <OpenToWork />
      </Suspense>
      <Suspense fallback={null}>
        <OpenRoles />
      </Suspense>
      <ClosingCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface subtle-grid-pattern">
      <Container width="wide" className="relative z-10 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3.5 py-1 text-[12px] font-medium text-fg-muted shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-accent" />
              <span>Proof-of-Work Platform for Builders, Artists & Developers</span>
            </div>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.08] tracking-tight sm:text-[54px] text-fg">
              Record the timelapse. <br />
              Prove the work. <span className="text-accent">Get paid.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] sm:text-[17px] leading-relaxed text-fg-muted">
              Create a timelapse of your deep work session and upload it. Once manually verified by
              moderators for authenticity, your session is listed publicly—unlocking automated bounties,
              audience sponsorships on Solana, and high-ticket client hiring based on verifiable execution.
            </p>
            <form action="/discover" className="relative mt-8 max-w-lg">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                type="search"
                name="q"
                placeholder="Search verified sessions, skills, or creators"
                aria-label="Search the catalog"
                className="h-12 w-full rounded-[var(--radius-control)] border border-border bg-surface pl-10 pr-28
                           text-sm placeholder:text-fg-subtle shadow-[var(--shadow-card)]
                           transition-colors duration-150 hover:border-border-strong focus:border-accent"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-[6px] bg-accent px-4
                           text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                Search
              </button>
            </form>

            {/* Quick search tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
              <span className="font-medium text-fg-muted">Popular stacks:</span>
              {["Rust", "Solana", "Next.js", "AI Pipelines", "3D & Blender", "Smart Contracts"].map((tag) => (
                <Link
                  key={tag}
                  href={`/discover?q=${encodeURIComponent(tag)}`}
                  className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/upload" size="lg">
                Upload timelapse & get paid
                <ArrowRightIcon size={17} />
              </ButtonLink>
              <ButtonLink href="/hire" variant="secondary" size="lg">
                Hire verified talent
              </ButtonLink>
              <ButtonLink href="/admin/verification" variant="secondary" size="lg" className="border-dashed">
                Admin review queue
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px] text-fg-muted">
              {TRUST_MARKERS.map((marker) => (
                <li key={marker} className="flex items-center gap-2">
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <CheckIcon size={11} />
                  </span>
                  {marker}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5">
            <HeroShowcase />
          </div>
        </div>
      </Container>
    </section>
  );
}

const TRUST_MARKERS = [
  "No passwords to manage",
  "Direct Solana settlement",
  "Milestone escrow",
] as const;

async function LiveStats() {
  const stats = await apiServer<PublicStats>("/v1/stats");
  if (!stats) return null;

  return <AnimatedStats stats={stats} />;
}

function StatsStripSkeleton() {
  return (
    <section className="border-b border-border bg-surface/80" aria-hidden>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-surface-raised" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-raised p-5" />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg py-16 sm:py-24">
      <Container width="wide">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
            The Three-Sided Ecosystem
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight sm:text-[34px] text-fg">
            Built for creators, moderators, and hiring teams
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-fg-muted">
            A verified proof-of-work pipeline connecting builders who record their work, manual moderation that keeps the catalog pristine, and companies hiring based on actual execution.
          </p>
        </div>

        {/* 3 Core Perspectives Cards */}
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {/* Perspective 1: Creator */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <UploadIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                POV 01
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <span>Creator / Uploader</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Create a timelapse & get paid
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Compress your 6-hour coding or design sprint into a 4-minute timelapse. Attach your Git repository or design proof, set your wallet, and unlock submission bounties and continuous sponsorships.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                Upload session & view payouts <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>

          {/* Perspective 2: Admin / Moderation */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-surface-raised text-fg">
                <ShieldIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                POV 02
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-fg">
              <span>Admin / Moderator</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Manual verification queue
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Every video enters a strict verification queue. Moderators inspect continuous screen activity, verify git commits match recordings, audit for credential leaks, and approve for public listing.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/admin/verification"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-fg hover:underline"
              >
                Open verification queue <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>

          {/* Perspective 3: Talent Acquisition / Hiring */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <BriefcaseIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                POV 03
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <span>Talent Acquisition</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Hire by verified proof
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Stop guessing based on static resumes. Watch how engineers debug, how architects design, and hire directly through non-custodial milestone escrows that release funds on proof delivery.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/hire"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                Browse verified creators <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Technical Guarantee strip */}
        <div className="mt-10 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:flex-row sm:items-center sm:gap-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldIcon size={20} />
          </span>
          <p className="text-sm leading-relaxed text-fg-muted">
            All sponsorships, verified creator bounties, and milestone payments settle non-custodially via audited Anchor programs on Solana. Platform records are tamper-proof and verifiable directly against the cluster.{" "}
            <Link href="/security" className="font-medium text-fg underline underline-offset-4 hover:text-accent">
              Audit and protocol specification
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}

function SessionsSkeleton() {
  return (
    <section className="border-b border-border">
      <Container width="wide" className="py-16 sm:py-20">
        <div className="mb-8 h-7 w-40 animate-pulse rounded bg-surface-raised" />
        <VideoGridSkeleton />
      </Container>
    </section>
  );
}

async function LatestSessions() {
  const [feed, health] = await Promise.all([
    apiServer<Page<Video>>("/v1/feed?limit=6"),
    apiServer<{ status: string }>("/health/ready"),
  ]);
  const videos = feed?.items ?? [];
  const apiDown = !health;

  return (
    <section className="border-b border-border bg-surface">
      <Container width="wide" className="py-16 sm:py-20">
        <SectionHeading
          title="Latest sessions"
          description="Work published in the last few days."
          action={
            <Link
              href="/discover"
              className="hidden items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg sm:inline-flex"
            >
              Browse all
              <ArrowRightIcon size={15} />
            </Link>
          }
        />
        {videos.length > 0 ? (
          <VideoGrid videos={videos} />
        ) : (
          <Card>
            <EmptyState
              icon={<UploadIcon size={26} />}
              title={apiDown ? "Catalog is connecting" : "Nothing published yet"}
              description={
                apiDown
                  ? "The public site is up. Sessions appear here as soon as the API and database are reachable."
                  : "The feed fills up as people publish their sessions. Yours can be the first."
              }
              action={<ButtonLink href="/upload">Publish a session</ButtonLink>}
            />
          </Card>
        )}
      </Container>
    </section>
  );
}

async function OpenToWork() {
  const talent = await apiServer<Page<PublicUser>>("/v1/talent?limit=4");
  const people = talent?.items ?? [];
  if (people.length === 0) return null;

  return (
    <section className="border-b border-border">
      <Container width="wide" className="py-16 sm:py-20">
        <SectionHeading
          title="Open to work"
          description="People whose track record is public and whose calendar is not full."
          action={
            <Link
              href="/hire"
              className="hidden items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg sm:inline-flex"
            >
              See everyone
              <ArrowRightIcon size={15} />
            </Link>
          }
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {people.map((person) => (
            <Card as="li" key={person.id} className="p-5">
              <Link href={`/creator/${person.handle}`} className="block">
                <Avatar name={person.displayName} src={person.avatarUrl} size={44} />
                <h3 className="mt-3 text-sm font-medium">{person.displayName}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {person.headline ?? `${person.videoCount} published sessions`}
                </p>
                <p className="mt-3 text-[12px] text-fg-subtle">
                  {person.hourlyRateUsd
                    ? `${formatUsd(person.hourlyRateUsd)}/hr`
                    : "Rate on request"}
                  {person.sponsorTotalLamports > 0
                    ? ` · ${formatSol(person.sponsorTotalLamports)} earned`
                    : ""}
                </p>
              </Link>
            </Card>
          ))}
        </ul>
      </Container>
    </section>
  );
}

async function OpenRoles() {
  const result = await apiServer<Page<Job>>("/v1/jobs?limit=3");
  const jobs = result?.items ?? [];
  if (jobs.length === 0) return null;

  return (
    <section className="border-b border-border bg-surface">
      <Container width="wide" className="py-16 sm:py-20">
        <SectionHeading
          title="Open roles"
          description="Funded up front. Released against delivered work."
          action={
            <Link
              href="/jobs"
              className="hidden items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg sm:inline-flex"
            >
              See all roles
              <ArrowRightIcon size={15} />
            </Link>
          }
        />
        <ul className="grid gap-4 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card as="li" key={job.id} className="p-5">
              <Link href={`/jobs/${job.slug}`} className="block">
                <p className="text-[12px] text-fg-subtle">
                  {job.client.displayName}
                  {job.publishedAt ? ` · ${timeAgo(job.publishedAt)}` : ""}
                </p>
                <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{job.title}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {job.description}
                </p>
                <p className="mt-3 text-[13px] font-medium tabular-nums">
                  {job.budgetMinUsd && job.budgetMaxUsd
                    ? `${formatUsd(job.budgetMinUsd)} – ${formatUsd(job.budgetMaxUsd)}`
                    : "Budget on request"}
                </p>
              </Link>
            </Card>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="py-16 sm:py-24">
      <Container width="wide">
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-8 sm:p-14">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">
                Hustle with verification
              </span>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
                The work is already happening. Put it on the record.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] sm:text-[16px] leading-relaxed text-fg-muted">
                One session is enough to start. Publish the timelapse, link your accounts, connect a
                wallet, and let sponsors support you directly on Solana while clients hire you with
                full confidence.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:flex-col lg:items-end">
              <ButtonLink
                href="/login?intent=start"
                size="lg"
                className="w-full justify-center text-center sm:w-auto lg:w-full"
              >
                Create your profile
                <ArrowRightIcon size={17} />
              </ButtonLink>
              <ButtonLink
                href="/discover"
                variant="secondary"
                size="lg"
                className="w-full justify-center text-center sm:w-auto lg:w-full"
              >
                Browse talent & sessions
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
