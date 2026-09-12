import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container width="narrow" className="py-24 text-center">
      <div className="animate-fade-in-up">
        {/* The numerals carry the page. Depth comes from the rule under them,
            never from a coloured halo. */}
        <div className="mx-auto mb-8 w-fit">
          <span className="tnum block text-[clamp(4.5rem,18vw,8.75rem)] font-semibold leading-none tracking-tighter text-fg">
            404
          </span>
          <span className="mx-auto mt-4 block h-px w-24 bg-border-strong" />
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
          This page does not exist
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">
          The link may be out of date, or the timelapse may not have been published.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Back to the feed</ButtonLink>
          <ButtonLink href="/about" variant="secondary">
            How it works
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
