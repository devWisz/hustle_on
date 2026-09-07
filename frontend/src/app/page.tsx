import Link from "next/link";
import { apiServer } from "@/lib/api";
import type { Page, Video, PublicUser } from "@/lib/types";
import { VideoGrid } from "@/components/video-card";
import { Avatar, ButtonLink, Card, Container, EmptyState, SectionHeading } from "@/components/ui";
import { ArrowRightIcon, ShieldIcon, UploadIcon, WalletIcon, BriefcaseIcon } from "@/components/icons";
import { formatSol, formatUsd } from "@/lib/format";

export const revalidate = 60;

export default async function HomePage() {
  const [feed, talent] = await Promise.all([
    apiServer<Page<Video>>("/v1/feed?limit=6"),
    apiServer<Page<PublicUser>>("/v1/talent?limit=4"),
  ]);

  return (
    <>
      <Hero />
      <HowItWorks />
      <LatestSessions videos={feed?.items ?? []} />
      <OpenToWork people={talent?.items ?? []} />
      <ClosingCta />
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <Container width="wide" className="py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent">
            Proof of work, for people
          </p>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
            Your hustle should be paid off.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted">
            Record the session. Publish the timelapse. The people who want that work to continue
            sponsor it directly, on chain, and the clients who need it hire you from a record they
            can actually watch.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login?intent=start" size="lg">
              Start publishing
              <ArrowRightIcon size={17} />
            </ButtonLink>
            <ButtonLink href="/discover" variant="secondary" size="lg">
              Watch what people are building
            </ButtonLink>
          </div>
          <p className="mt-5 text-[13px] text-fg-subtle">
            No password to forget. Sign in with an email link, connect a wallet when you are ready
            to get paid.
          </p>
        </div>
      </Container>
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
    <section className="border-b border-border bg-surface">
      <Container width="wide" className="py-16 sm:py-20">
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {steps.map((step, index) => (
            <div key={step.title}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                  <step.icon size={18} />
                </span>
                <span className="text-[13px] font-medium tabular-nums text-fg-subtle">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-4 text-[17px] font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-bg p-6 sm:flex-row sm:items-center sm:gap-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
            <ShieldIcon size={20} />
          </span>
          <p className="text-sm leading-relaxed text-fg-muted">
            Sponsorships and escrow settle through an audited Solana program with the platform fee
            capped on chain. We verify every transaction against the cluster before a single total
            moves, and we never hold custody of your funds.{" "}
            <Link href="/security" className="font-medium text-fg underline underline-offset-4">
              How this works
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}

function LatestSessions({ videos }: { videos: Video[] }) {
  return (
    <section className="border-b border-border">
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
              title="Nothing published yet"
              description="The feed fills up as people publish their sessions. Yours can be the first."
              action={<ButtonLink href="/upload">Publish a session</ButtonLink>}
            />
          </Card>
        )}
      </Container>
    </section>
  );
}

function OpenToWork({ people }: { people: PublicUser[] }) {
  if (people.length === 0) return null;

  return (
    <section className="border-b border-border bg-surface">
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
                  {person.hourlyRateUsd ? `${formatUsd(person.hourlyRateUsd)}/hr` : "Rate on request"}
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

function ClosingCta() {
  return (
    <section>
      <Container width="wide" className="py-20 sm:py-24">
        <div className="max-w-xl">
          <h2 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">
            The work is already happening. Put it on the record.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
            One session is enough to start. Publish it, link your accounts, connect a wallet, and
            let the people who care about the work pay for it to continue.
          </p>
          <div className="mt-8">
            <ButtonLink href="/login?intent=start" size="lg">
              Create your profile
              <ArrowRightIcon size={17} />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
