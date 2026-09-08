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
  WalletIcon,
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
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/60 via-surface/30 to-bg cyber-grid-pattern">
      {/* Ambient floating glowing auras */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl animate-aura"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl animate-aura"
        style={{ animationDelay: "3s" }}
        aria-hidden
      />

      <Container width="wide" className="relative z-10 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3.5 py-1 text-[12px] font-medium text-fg-muted shadow-sm backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span>Proof of work, for builders & creators</span>
            </div>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.08] tracking-tight sm:text-[54px] gradient-text-accent">
              Your hustle should be paid off.
            </h1>
            <p className="mt-6 max-w-xl text-[16px] sm:text-[17px] leading-relaxed text-fg-muted">
              Record the session. Publish the timelapse. The people who want your work to continue
              sponsor it directly on Solana, and clients who need your talent hire you from a track
              record they can actually watch.
            </p>
            <form action="/discover" className="relative mt-8 max-w-lg">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                type="search"
                name="q"
                placeholder="Search sessions, skills, or people"
                aria-label="Search the catalog"
                className="h-12 w-full rounded-[var(--radius-control)] border border-border bg-surface pl-10 pr-28
                           text-sm placeholder:text-fg-subtle shadow-[var(--shadow-card)]
                           transition-all duration-200 hover:border-border-strong focus:border-accent focus:shadow-[0_0_12px_rgba(63,178,140,0.2)]"
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
              <span>Trending:</span>
              {["#solana", "#rust", "#nextjs", "#smartcontracts", "#ai"].map((tag) => (
                <Link
                  key={tag}
                  href={`/discover?q=${encodeURIComponent(tag.replace("#", ""))}`}
                  className="rounded border border-border bg-surface/80 px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ButtonLink href="/login?intent=start" size="lg" className="shadow-sm hover:shadow-md">
                Start publishing
                <ArrowRightIcon size={17} />
              </ButtonLink>
              <ButtonLink href="/discover" variant="secondary" size="lg">
                Watch what people are building
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

const steps = [
  {
    icon: UploadIcon,
    title: "Publish the session",
    body: "Six hours at the desk becomes a four minute timelapse. Say what you worked on and how long it really took.",
  },
  {
    icon: WalletIcon,
    title: "Get sponsored",
    body: "Viewers send SOL straight to your wallet through the escrow program. Nothing sits with us in between.",
  },
  {
    icon: BriefcaseIcon,
    title: "Get hired",
    body: "Clients open milestone engagements against your record. Funds are escrowed up front and released on delivery.",
  },
] as const;

function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-bg to-surface/40 py-16 sm:py-24">
      <Container width="wide">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            The Core Architecture
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight sm:text-[34px]">
            From recorded session to on-chain payout
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-fg-muted">
            Three interconnected steps converting builder hustle into indisputable public proof.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]
                         transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-raised)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
                  <step.icon size={20} />
                </span>
                <span className="font-mono text-[14px] font-bold text-fg-subtle transition-colors group-hover:text-accent">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>

              {/* Glowing bottom accent line */}
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-accent to-emerald-400 transition-all duration-300 group-hover:w-full" />
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-6 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldIcon size={20} />
          </span>
          <p className="text-sm leading-relaxed text-fg-muted">
            Sponsorships and escrow settle through an audited Solana program with the platform fee
            capped on chain. We verify every transaction against the cluster before a single total
            moves, and we never hold custody of your funds.{" "}
            <Link href="/security" className="font-medium text-fg underline underline-offset-4 hover:text-accent">
              How this works
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
