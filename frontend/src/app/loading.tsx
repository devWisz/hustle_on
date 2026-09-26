import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container width="wide" className="pt-14">
      <div className="skeleton h-12 w-2/3 max-w-xl" aria-hidden />
      <div className="skeleton mt-4 h-5 w-96 max-w-full" aria-hidden />
      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-video w-full rounded-[var(--radius-card)]" />
            <div className="skeleton mt-4 h-4 w-1/3" />
            <div className="skeleton mt-3 h-5 w-4/5" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading
      </span>
    </Container>
  );
}
