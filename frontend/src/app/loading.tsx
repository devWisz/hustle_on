import { Container } from "@/components/ui";

/** Default route-level pending state: a heading and a grid, in skeleton form. */
export default function Loading() {
  return (
    <Container className="py-12">
      <div className="h-7 w-40 animate-pulse rounded bg-surface-raised" aria-hidden />
      <div
        className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-surface-raised"
        aria-hidden
      />
      <div className="mt-10 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className="aspect-video w-full animate-pulse rounded-[var(--radius-card)] bg-surface-raised" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-surface-raised" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-raised" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading.
      </span>
    </Container>
  );
}
