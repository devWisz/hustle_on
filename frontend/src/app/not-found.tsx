import Link from "next/link";
import { getFeed } from "@/lib/data";
import { NotFoundDigits, SearchInstead } from "@/components/layout/not-found-art";
import { Reveal } from "@/components/motion/reveal";
import { TimelapseGrid } from "@/components/timelapse/grid";
import { Container } from "@/components/ui";
import { ArrowRightIcon } from "@/components/ui/icons";

const PLACES = [
  { href: "/#feed", title: "Browse the feed", body: "Sessions people funded and watched most." },
  { href: "/about", title: "How it works", body: "From recording to review to sponsorship." },
  {
    href: "/upload",
    title: "Upload a timelapse",
    body: "Put your own session in front of people.",
  },
  { href: "/dashboard", title: "Your dashboard", body: "Submissions, decisions and sponsorships." },
];

export default async function NotFound() {
  const feed = await getFeed("watched");
  const popular = feed.data.slice(0, 3);

  return (
    <Container width="wide" className="pt-10 sm:pt-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <NotFoundDigits />
        </div>
        <Reveal immediate delay={0.4} className="lg:col-span-5 lg:pb-6">
          <p className="text-eyebrow">Error 404</p>
          <h1 className="text-title mt-4">This page never made it past review.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
            The link may be out of date, the session may have been withdrawn, or it was never
            published. Search for what you were after, or pick up from one of these.
          </p>
          <div className="mt-7">
            <SearchInstead />
          </div>
        </Reveal>
      </div>

      <Reveal stagger={0.07} className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLACES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="lift group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5"
          >
            <span className="flex items-center justify-between text-[15px] font-semibold">
              {p.title}
              <ArrowRightIcon size={15} className="nudge-icon text-fg-subtle" />
            </span>
            <span className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">{p.body}</span>
          </Link>
        ))}
      </Reveal>

      {popular.length ? (
        <section className="mt-20" aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="text-[20px] font-semibold tracking-tight">
            Most watched right now
          </h2>
          <div className="mt-8">
            <TimelapseGrid items={popular} demo={feed.demo} />
          </div>
        </section>
      ) : null}
    </Container>
  );
}
