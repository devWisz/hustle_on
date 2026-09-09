import { Suspense } from "react";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Job, Page, PublicStats, PublicUser, Video } from "@/lib/types";
import { VideoGrid, VideoGridSkeleton } from "@/components/video-card";
import { Avatar, ButtonLink, Card, Container, EmptyState, SectionHeading } from "@/components/ui";
import { AnimatedStats } from "@/components/animated-stats";
import { HeroShowcase } from "@/components/hero-showcase";
import { PayoutCalculator } from "@/components/payout-calculator";
import { EscrowInspector } from "@/components/escrow-inspector";
import {
  ArrowRightIcon,
  CheckIcon,
  SearchIcon,
  ShieldIcon,
  SolanaIcon,
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
      <InteractiveEngineeringSuite />
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
              <span>Verifiable Proof-of-Work · Solana Anchor Escrows</span>
            </div>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.08] tracking-tight sm:text-[54px] text-fg">
              Record the timelapse. <br />
              Prove the work. <span className="text-accent">Get paid.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] sm:text-[17px] leading-relaxed text-fg-muted">
              Compress 8-hour deep engineering sprints into verifiable timelapses. Automated SHA-256 frame
              trees match Git commits. Milestone escrows unlock atomically on Solana. Zero fake resumes.
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
              <span className="font-medium text-fg-muted">Stacks:</span>
              {["Rust", "Solana", "Next.js", "Go Systems", "Smart Contracts", "3D WebGL"].map((tag) => (
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
              <ButtonLink href="/discover" variant="ghost" size="lg">
                Browse sessions
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
  "Non-custodial Solana Anchor PDA",
  "SHA-256 Merkle frame verification",
  "Instant 400ms finality payouts",
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
            <div
              key={i}
              className="h-32 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-raised p-5"
            />
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
            Proof-of-Work Architecture
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight sm:text-[34px] text-fg">
            How Sardhana guarantees authentic talent
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-fg-muted">
            Replacing self-reported CVs with deterministic execution telemetry, cryptographic VCS matching, and Solana milestone escrow.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {/* Pillar 1: Proof Capture */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <UploadIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                PILLAR 01
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <span>Continuous Timelapse</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Capture proof of execution
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Compress your 6-hour build sprint into an 8x–32x timelapse. Screen frames are cryptographically
              hashed and paired directly with git commit trees and branch diffs.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                Upload session & claim bounty <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>

          {/* Pillar 2: Deterministic Verification Engine */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <ShieldIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                PILLAR 02
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <span>Integrity Verification</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Automated + Human Audit
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Screen entropy scans verify active authoring. VCS timestamps match video frames.
              Credential scanners scrub secrets before public catalog listing.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/creator/how-to-earn"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-fg hover:underline"
              >
                Verification protocol specs <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>

          {/* Pillar 3: Talent Acquisition / Escrow */}
          <div className="group rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                <SolanaIcon size={20} />
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                PILLAR 03
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <span>Solana Anchor Escrow</span>
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-fg">
              Non-custodial settlement
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Clients lock milestone capital into program-derived accounts. Funds release atomically
              to the developer&apos;s Solana wallet upon cryptographic proof verification.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Link
                href="/hire"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                Browse verified engineers <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Technical Guarantee Banner */}
        <div className="mt-10 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:flex-row sm:items-center sm:gap-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldIcon size={20} />
          </span>
          <p className="text-sm leading-relaxed text-fg-muted">
            All creator bounties, audience sponsorships, and milestone contracts settle on-chain via Anchor programs on Solana.
            Transactions are non-custodial, peer-to-peer, and verified against cluster state in &lt;400ms.
          </p>
        </div>
      </Container>
    </section>
  );
}

function InteractiveEngineeringSuite() {
  return (
    <section className="border-b border-border bg-surface/50 py-16 sm:py-24">
      <Container width="wide">
        <div className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
            Interactive Tools
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight sm:text-[32px] text-fg">
            Simulate payouts & inspect on-chain escrow
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">
            Test timelapse compression, estimate SOL/USD bounty payouts, and inspect the Anchor escrow state machine.
          </p>
        </div>

        {/* Tool 1: Live Payout Calculator */}
        <div className="mb-14">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-fg">
              Feature 1: Live Timelapse Speed & Payout Engine
            </h3>
            <span className="text-xs font-mono text-fg-subtle">Instant Reactive Computation</span>
          </div>
          <PayoutCalculator />
        </div>

        {/* Tool 2: Verifiable Anchor Escrow State Machine */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-fg">
              Feature 2: Verifiable Solana Anchor Escrow State Machine
            </h3>
            <span className="text-xs font-mono text-fg-subtle">Live PDA Telemetry & Rust Source</span>
          </div>
          <EscrowInspector />
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
          description="Verified proof-of-work published across engineering stacks."
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
          description="Engineers with verified timelapses and available capacity."
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
          description="Funded in milestone escrow. Released upon verified delivery."
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
                Proof-of-Work Standard
              </span>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
                The work is already happening. Put it on the record.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] sm:text-[16px] leading-relaxed text-fg-muted">
                Publish your engineering sprint timelapse. Settle bounties directly in SOL. Let clients
                hire you with mathematical certainty.
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
                Browse sessions
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
