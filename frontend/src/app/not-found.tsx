import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container width="narrow" className="py-24 text-center">
      <div className="animate-fade-in-up">
        {/* Large animated 404 */}
        <div className="relative mx-auto mb-6 w-fit">
          <span className="text-[clamp(4.5rem,18vw,8.75rem)] font-bold leading-none tracking-tighter text-accent">
            404
          </span>
          <div className="absolute inset-0 blur-3xl opacity-20 gradient-accent-bg rounded-full" />
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
