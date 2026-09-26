import { Reveal } from "../motion/reveal";
import { SplitHeading } from "../motion/split-heading";
import { Container } from "../ui";

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly { title: string; body: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <Container width="wide" className="pb-8 pt-14 sm:pt-20">
      <p className="text-eyebrow">{eyebrow}</p>
      <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
        {title}
      </SplitHeading>
      <Reveal immediate delay={0.2}>
        <p className="text-lede mt-5 max-w-2xl text-fg-muted">{intro}</p>
      </Reveal>

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ol className="sticky top-28 space-y-2 text-[13px]">
            {sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#s-${i + 1}`} className="flex gap-3 text-fg-muted transition-colors hover:text-fg">
                  <span className="font-mono text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <ol className="max-w-2xl divide-y divide-border border-y border-border">
          {sections.map((s, i) => (
            <Reveal as="li" key={s.title} className="scroll-mt-24 py-8" y={16}>
              <div id={`s-${i + 1}`}>
                <p className="font-mono text-[12px] text-fg-subtle">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="mt-2 text-[20px] font-semibold tracking-tight">{s.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
      {footer ? <div className="mt-10 max-w-2xl text-[15px] text-fg-muted lg:ml-[268px]">{footer}</div> : null}
    </Container>
  );
}
