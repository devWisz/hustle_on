import { Container } from "@/components/ui";
import { VideoGridSkeleton } from "@/components/video-card";

/**
 * Default route-level pending state. The homepage streams its own hero, so
 * this shape is for catalog pages that lead with a heading and a grid.
 */
export default function Loading() {
  return (
    <Container width="wide" className="py-12">
      <div className="h-7 w-40 animate-pulse rounded bg-surface-raised" aria-hidden />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-surface-raised" aria-hidden />
      <div className="mt-8">
        <VideoGridSkeleton />
      </div>
      <span className="sr-only" role="status">
        Loading.
      </span>
    </Container>
  );
}
