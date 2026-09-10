import { Container } from "@/components/ui";

/** Default route-level pending state: shimmer skeletons instead of flat pulses. */
export default function Loading() {
  return (
    <Container className="py-12">
      <div className="h-7 w-40 skeleton-shimmer" aria-hidden />
      <div className="mt-3 h-4 w-72 max-w-full skeleton-shimmer" aria-hidden />
      <div className="mt-10 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ animationDelay: `${i * 100}ms` }}>
            <div className="aspect-video w-full skeleton-shimmer rounded-[var(--radius-card)]" />
            <div className="mt-3 h-4 w-3/4 skeleton-shimmer" />
            <div className="mt-2 h-3 w-1/2 skeleton-shimmer" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading.
      </span>
    </Container>
  );
}
