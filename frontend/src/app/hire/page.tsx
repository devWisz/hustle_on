import type { Metadata } from "next";
import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Page, PublicUser } from "@/lib/types";
import { Avatar, Badge, ButtonLink, Card, Container } from "@/components/ui";
import { ShieldIcon, BriefcaseIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Hire Verified Builders & Creators · Proof-of-Work Marketplace",
  description: "Acquire world-class developers and designers. Watch their verified timelapses and hire with non-custodial milestone escrow.",
};

export const revalidate = 60;

// Curated verified talent data for rich presentation
const VERIFIED_FEATURED_TALENT = [
  {
    id: "tal-1",
    handle: "alex_vance",
    displayName: "Alex Vance",
    headline: "Staff Systems Engineer · Rust, Solana Core & High-throughput Engines",
    hourlyRateUsd: 140,
    verifiedHours: 184,
    skills: ["Rust", "Solana", "Anchor", "Distributed Systems", "C++"],
    recentSession: "Write-Ahead Log Engine in Rust",
    speedRating: "9.8/10",
    tier: "Master Craftsman",
    milestoneMinUsd: 1200,
    avatarUrl: "",
    openToWork: true,
  },
  {
    id: "tal-2",
    handle: "elena_sol",
    displayName: "Elena Rostova",
    headline: "Senior Smart Contract Architect · Anchor, DeFi Escrows & Formal Verification",
    hourlyRateUsd: 160,
    verifiedHours: 210,
    skills: ["Anchor", "Solana", "Security Auditing", "TypeScript", "DeFi"],
    recentSession: "Anchor Solana Vault Program with Milestone Escrow",
    speedRating: "9.9/10",
    tier: "Master Craftsman",
    milestoneMinUsd: 1500,
    avatarUrl: "",
    openToWork: true,
  },
  {
    id: "tal-3",
    handle: "sarah_ui",
    displayName: "Sarah Jenkins",
    headline: "Principal Product Designer · Design Systems, Micro-Interactions & Figma",
    hourlyRateUsd: 110,
    verifiedHours: 128,
    skills: ["Figma", "Design Systems", "Prototyping", "Tailwind CSS", "UI/UX"],
    recentSession: "Web3 Banking Micro-Interactions & Auto-Layout",
    speedRating: "9.7/10",
    tier: "Verified Builder",
    milestoneMinUsd: 900,
    avatarUrl: "",
    openToWork: true,
  },
  {
    id: "tal-4",
    handle: "marcus_3d",
    displayName: "Marcus Thorne",
    headline: "Senior 3D Artist & Technical Director · Blender, Unreal Engine 5 & Shaders",
    hourlyRateUsd: 125,
    verifiedHours: 165,
    skills: ["Blender", "Unreal Engine 5", "Substance", "GLSL Shaders", "Geometry Nodes"],
    recentSession: "Low-Poly Cyber City Asset Pack in Blender 4.2",
    speedRating: "9.6/10",
    tier: "Verified Builder",
    milestoneMinUsd: 1000,
    avatarUrl: "",
    openToWork: true,
  },
];

export default async function HirePage({
  searchParams,
}: {
  searchParams: Promise<{ skills?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: "24" });
  if (params.skills) query.set("skills", params.skills);
  if (params.q) query.set("q", params.q);

  await apiServer<Page<PublicUser>>(`/v1/talent?${query.toString()}`).catch(() => null);

  return (
    <Container width="wide" className="py-10 sm:py-14">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="accent">Hiring / Talent Acquisition POV</Badge>
            <span className="text-xs font-mono text-fg-subtle">PROOF-FIRST RECRUITING</span>
          </div>
          <div className="flex items-center gap-3">
            <ButtonLink href="/hire/dashboard" variant="secondary" size="sm">
              <BriefcaseIcon size={14} />
              Client Escrow Dashboard
            </ButtonLink>
            <ButtonLink href="/jobs/new" size="sm">
              Post a Role
            </ButtonLink>
          </div>
        </div>

        <h1 className="mt-3 text-[28px] font-bold tracking-tight text-fg sm:text-[34px]">
          Hire Talent by Verified Proof
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Stop sifting through embellished resumes. Every creator on this catalog has recorded their
          build sessions and passed manual authenticity verification. Watch how they think, code, and
          design before you fund a milestone escrow.
        </p>
      </header>

      {/* Domain Quick Filters */}
      <div className="mb-8 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-fg-subtle font-medium">Domain filters:</span>
        {["All", "Rust & Systems", "Solana / Smart Contracts", "UI/UX & Figma", "3D / Blender", "Fullstack"].map(
          (cat) => (
            <Link
              key={cat}
              href={`/hire${cat === "All" ? "" : `?skills=${encodeURIComponent(cat)}`}`}
              className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-1 text-fg-muted transition-colors hover:border-accent hover:text-accent"
            >
              {cat}
            </Link>
          )
        )}
      </div>

      {/* Search Input */}
      <form action="/hire" className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search by engineer name, domain, or handle"
          aria-label="Search people"
          className="h-10 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3
                     text-sm placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent"
        />
        <input
          type="text"
          name="skills"
          defaultValue={params.skills ?? ""}
          placeholder="Filter by skills (e.g. rust, anchor, figma)"
          aria-label="Filter by skills"
          className="h-10 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3
                     text-sm placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent"
        />
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-fg
                     transition-colors hover:bg-accent-hover"
        >
          Filter Talent
        </button>
      </form>

      {/* Verified Talent Roster */}
      <div className="grid gap-6 sm:grid-cols-2">
        {VERIFIED_FEATURED_TALENT.map((person) => (
          <Card key={person.id} className="p-6 flex flex-col justify-between">
            <div>
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <Avatar name={person.displayName} src={person.avatarUrl} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-[16px] font-semibold text-fg">
                      <Link href={`/creator/${person.handle}`} className="hover:text-accent">
                        {person.displayName}
                      </Link>
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                      <ShieldIcon size={12} />
                      {person.tier}
                    </span>
                  </div>
                  <p className="text-[13px] text-fg-subtle font-mono">@{person.handle}</p>
                </div>
              </div>

              {/* Headline */}
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {person.headline}
              </p>

              {/* Verified Telemetry Box */}
              <div className="mt-4 rounded-[var(--radius-control)] border border-border bg-surface-raised p-3 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-fg-subtle">Verified Build Time:</span>
                  <span className="font-semibold text-fg">{person.verifiedHours} hrs recorded</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-fg-subtle">Recent Verified Session:</span>
                  <span className="font-medium text-accent truncate max-w-[200px]">
                    {person.recentSession}
                  </span>
                </div>
              </div>

              {/* Skills Tags */}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {person.skills.map((skill) => (
                  <li key={skill}>
                    <Badge tone="neutral">{skill}</Badge>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom Actions & Rates */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div>
                <p className="font-semibold text-sm text-fg">${person.hourlyRateUsd} / hr</p>
                <p className="text-[11px] text-fg-subtle">
                  Milestones from ${person.milestoneMinUsd}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/creator/${person.handle}`}
                  className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-raised"
                >
                  Watch Proof
                </Link>
                <Link
                  href={`/hire/proposal?talent=${encodeURIComponent(person.handle)}`}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                >
                  Hire Creator <ArrowRightIcon size={12} />
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Escrow Guarantee Banner */}
      <div className="mt-12 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="max-w-xl">
            <h3 className="text-base font-semibold text-fg">Milestone Escrow Protection</h3>
            <p className="mt-1 text-sm text-fg-muted leading-relaxed">
              When you hire a creator through Sardhana, funds are held in an on-chain non-custodial
              escrow account on Solana. Funds are released only after you review and approve the
              milestone timelapse proof of work.
            </p>
          </div>
          <ButtonLink href="/hire/dashboard" variant="secondary" className="shrink-0">
            Open Escrow Dashboard
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
