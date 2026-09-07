import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container width="narrow" className="py-24 text-center">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-fg-subtle">404</p>
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight">This page does not exist</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">
        The link may be out of date, or the session may have been made private by its creator.
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <ButtonLink href="/discover" variant="secondary">
          Browse sessions
        </ButtonLink>
        <ButtonLink href="/">Go home</ButtonLink>
      </div>
    </Container>
  );
}
