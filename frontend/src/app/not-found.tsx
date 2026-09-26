import { SplitHeading } from "@/components/motion/split-heading";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container width="wide" className="grid-backdrop py-20 sm:py-32">
      <p className="text-eyebrow">Error 404</p>
      <SplitHeading as="h1" onScroll={false} className="text-display mt-5 max-w-4xl">
        This page never made it past review.
      </SplitHeading>
      <Reveal immediate delay={0.3}>
        <p className="text-lede mt-6 max-w-xl text-fg-muted">
          The link may be out of date, or the session may not have been published.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            Back to the feed
          </ButtonLink>
          <ButtonLink href="/about" variant="secondary" size="lg">
            How it works
          </ButtonLink>
        </div>
      </Reveal>
    </Container>
  );
}
