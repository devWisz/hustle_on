import { Container } from "@/components/ui";
import { VideoGridSkeleton } from "@/components/video-card";

/**
 * The default route-level pending state.
 *
 * Most routes here lead with a heading and a grid of sessions, so this shape
 * fits them without a jump. Routes with a different shape provide their own
 * `loading.tsx` beside the page.
 */
export default function Loading() {
  return (
    <Container width="wide" className="py-12">
      <div className="h-7 w-40 animate-pulse rounded bg-surface-raised" aria-hidden />
      <div className="mt-8">
        <VideoGridSkeleton />
      </div>
      <span className="sr-only" role="status">
        Loading.
      </span>
    </Container>
  );
}
