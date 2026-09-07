import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description: "Why Sardhana exists.",
};

export default function AboutPage() {
  return (
    <Container width="narrow" className="py-14 sm:py-20">
      <h1 className="text-[28px] font-semibold tracking-tight">Your hustle should be paid off</h1>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-fg-muted">
        <p>
          Most of the work that matters is invisible. The finished thing gets shared; the four
          hundred hours behind it do not. So the people who put in those hours have nothing to
          point at except the outcome, and the people who would happily pay for that work to
          continue never see it happening.
        </p>
        <p>
          Sardhana is built on a simple exchange. You record your working sessions and publish them
          as timelapses. Anyone can watch how the work actually goes — the false starts, the
          debugging, the hours that did not make the highlight reel. If they want it to continue,
          they sponsor it, directly, in a transfer that settles on chain and never passes through
          us. If they want it done for them, they hire you against a record they have already
          watched.
        </p>
        <p>
          There is no algorithm deciding whose work deserves attention, no engagement score, and no
          advertising. There is a public log of what people did and how long it took, and the means
          for that to be paid for.
        </p>
      </div>

      <div className="mt-10">
        <ButtonLink href="/login?intent=start" size="lg">
          Start publishing
        </ButtonLink>
      </div>
    </Container>
  );
}
