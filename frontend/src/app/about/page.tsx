import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "How it works",
  description: "What Sardhana is, and what happens between an upload and a donation.",
};

export default function AboutPage() {
  return (
    <Container width="narrow" className="py-16">
      <div className="animate-fade-in-up">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          How it <span className="gradient-text">works</span>
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-fg-muted">
          Sardhana is a record of work that actually happened. You record a session, describe what you
          did, and point at where the result lives. Someone reads it. If it holds up, it goes on the
          feed — and anyone who thinks it was worth doing can send you SOL directly.
        </p>
      </div>

      <ol className="mt-14 space-y-0">
        <Step
          n={1}
          title="Record the session"
          body="A timelapse of the work itself. There is no minimum quality bar and no editing expected — the clip is evidence, not a production."
        />
        <Step
          n={2}
          title="Write down what you did"
          body="The part nobody can get from watching: what you were trying to do, what went wrong, what you ended up with. Add the GitHub repository or the X post if the result is public, so a reader can check rather than take your word for it."
        />
        <Step
          n={3}
          title="A person reviews it"
          body="Every submission is read before it goes up. If it is declined you get a written reason on your dashboard and can fix it and send it back. Nothing reaches the feed automatically."
        />
        <Step
          n={4}
          title="People fund what they want more of"
          body="Donations are plain SOL transfers from a viewer's wallet to yours. Sardhana never holds the money and takes no cut. Every donation shown on the site was read back off the chain and checked before it was counted."
          isLast
        />
      </ol>

      <section className="mt-14 border-t border-border pt-8">
        <div className="flex items-center gap-2">
          <ShieldIcon size={20} className="text-accent" />
          <h2 className="text-[19px] font-semibold">What Sardhana will never do</h2>
        </div>
        <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-fg-muted">
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            Ask for a seed phrase or a private key. Not for signing in, not for payouts.
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            Take custody of a donation. The transfer is wallet to wallet.
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            Store a password. Signing in is an emailed link that works once.
          </li>
        </ul>
      </section>

      <div className="mt-12">
        <ButtonLink href="/upload" size="lg">
          Upload a timelapse
        </ButtonLink>
      </div>
    </Container>
  );
}

function Step({
  n,
  title,
  body,
  isLast = false,
}: {
  n: number;
  title: string;
  body: string;
  isLast?: boolean;
}) {
  return (
    <li className={`flex gap-5 ${isLast ? "" : "step-connector"} pb-10`} style={{ listStyle: "none" }}>
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                   bg-accent-soft border border-accent/20 text-[13px] font-semibold
                   tabular-nums text-accent transition-all duration-300
                   hover:bg-accent hover:text-accent-fg hover:shadow-[var(--shadow-glow)]"
      >
        {n}
      </span>
      <div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </li>
  );
}
