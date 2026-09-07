import { Container } from "@/components/ui";

/** Skeleton shown while a route's data resolves. Matches the feed's rhythm so
 *  the layout does not jump when content arrives. */
export default function Loading() {
  return (
    <Container width="wide" className="py-12">
      <div className="h-7 w-40 animate-pulse rounded bg-surface-raised" />
      <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <div className="aspect-video animate-pulse rounded-[var(--radius-card)] bg-surface-raised" />
            <div className="mt-3 flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-raised" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-surface-raised" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
