import type { Metadata } from "next";
import { Magnetic } from "@/components/motion/magnetic";
import { ProgressRail } from "@/components/motion/progress-rail";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { ButtonLink, Container } from "@/components/ui";
import { ArrowRightIcon, CloseIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "How it works",
  description: "What Sardhana is, and what happens between an upload and a sponsorship.",
};

const STEPS = [
  {
    title: "Record yourself working",
    body: "Hit record when you sit down to work on something: painting, woodwork, sewing, code, a launch, an exam. Film yourself, your desk or your screen, for as long as the session takes. Check nothing private is in frame.",
  },
  {
    title: "Turn it into a timelapse",
    body: "Speed the session up so hours of work fit into a minute or two. No editing expected. The clip is evidence, not a production.",
  },
  {
    title: "Upload it with a write-up",
    body: "Say what you set out to do, what went wrong and what you ended up with, and link the finished result so anyone can check.",
  },
  {
    title: "An admin approves it",
    body: "A reviewer compares the write-up with the recording before anything goes public. If it is sent back, you get a reason you can act on.",
  },
  {
    title: "People sponsor your hustle",
    body: "Once it is live, anyone can watch it. Viewers who think the work was worth it sign in and send SOL straight from their wallet to yours, so you can see who backed you. Sardhana never holds the money and takes no cut, and every transfer is verified on-chain. Some will reach out to hire you instead.",
  },
];

const NEVER = [
  "Ask for a seed phrase or a private key, for signing in or for payouts.",
  "Take custody of a sponsorship. The transfer is wallet to wallet.",
  "Store a password. Signing in is an emailed link that works once.",
  "Publish anything without a person reading it first.",
];

export default function AboutPage() {
  return (
    <>
      <section className="grid-backdrop">
        <Container width="wide" className="pb-16 pt-14 sm:pb-24 sm:pt-24">
          <p className="text-eyebrow">How it works</p>
          <SplitHeading as="h1" onScroll={false} className="text-display mt-5 max-w-5xl">
            A record of work that actually happened.
          </SplitHeading>
          <Reveal immediate delay={0.35}>
            <p className="text-lede mt-8 max-w-2xl text-fg-muted">
              You record a session, describe what you did, and point at where the result lives.
              Someone reads it. If it holds up, it goes on the feed, and anyone who thinks it was
              worth doing can sponsor you directly.
            </p>
          </Reveal>
        </Container>
      </section>

      <Container width="wide" className="pt-8">
        <ol className="relative mx-auto max-w-3xl">
          <ProgressRail className="bottom-10 left-[23px] top-10" />
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} className="relative flex gap-6 py-8 sm:gap-10">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-bg font-mono text-[14px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="pt-2">
                <h2 className="text-[clamp(1.35rem,1.1rem+1vw,1.9rem)] font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>

      <section className="pt-20 sm:pt-28">
        <Container width="wide">
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-12">
            <p className="text-eyebrow">Hard lines</p>
            <SplitHeading className="text-title mt-4">What Sardhana will never do</SplitHeading>
            <Reveal as="ul" stagger={0.08} className="mt-10 grid gap-4 sm:grid-cols-2">
              {NEVER.map((line) => (
                <li
                  key={line}
                  className="flex gap-4 rounded-[var(--radius-card)] border border-border p-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                    <CloseIcon size={14} />
                  </span>
                  <p className="text-[15px] leading-relaxed text-fg-muted">{line}</p>
                </li>
              ))}
            </Reveal>
          </div>

          <Reveal className="mt-16 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-title max-w-xl">Ready to put a session in front of people?</p>
            <Magnetic>
              <ButtonLink href="/upload" size="lg">
                Upload a timelapse
                <ArrowRightIcon size={16} className="nudge-icon" />
              </ButtonLink>
            </Magnetic>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
