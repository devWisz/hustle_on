import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDashboard } from "@/lib/data";
import { formatSol, timeAgo } from "@/lib/format";
import { SavedList } from "@/components/account/saved-list";
import { Submissions } from "@/components/account/submissions";
import { DemoGate } from "@/components/demo/demo";
import { DemoNote } from "@/components/demo/tag";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Avatar, ButtonLink, Card, Container } from "@/components/ui";
import { ArrowRightIcon, CheckIcon, UploadIcon, WalletIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();
  if (data === "signin") redirect("/login?next=/dashboard");
  const { me, items, donations, demo } = data;

  const views = items.reduce((n, t) => n + t.viewCount, 0);
  const inReview = items.filter((t) => t.status === "in_review").length;
  const tiles = [
    {
      label: "Published",
      value: (
        <CountUp value={items.filter((t) => t.status === "published").length} format="plain" />
      ),
    },
    { label: "In review", value: <CountUp value={inReview} format="plain" /> },
    { label: "Total views", value: <CountUp value={views} /> },
    { label: "Raised", value: <CountUp value={me.donationTotalLamports} format="sol" /> },
  ];

  return (
    <Container width="wide" className="pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow">Creator dashboard</p>
          <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
            {`Welcome back, ${me.displayName.split(" ")[0]}.`}
          </SplitHeading>
        </div>
        <Reveal immediate delay={0.2} className="flex gap-2">
          <ButtonLink href="/upload">
            <UploadIcon size={16} />
            New upload
          </ButtonLink>
          <ButtonLink href={`/creator/${me.handle}`} variant="secondary">
            Profile
          </ButtonLink>
        </Reveal>
      </div>

      {demo ? (
        <DemoNote className="mt-8">
          A sample account, so you can see the screen with work on it. Nothing here belongs to
          anybody and nothing you do is saved.
        </DemoNote>
      ) : null}

      <Reveal as="dl" stagger={0.07} className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
          >
            <dt className="text-[12.5px] text-fg-muted">{t.label}</dt>
            <dd className="tnum mt-3 text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] font-semibold leading-none tracking-tight">
              {t.value}
            </dd>
          </div>
        ))}
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal as="section">
          <h2 id="subs-heading" className="text-[20px] font-semibold tracking-tight">
            Submissions
          </h2>
          <div className="mt-4">
            <Submissions items={items} demo={demo} />
          </div>
          {demo ? (
            <DemoGate
              className="mt-6"
              title="This is where your own submissions would be"
              body="An account is one email and one click on a link. Your first upload goes to review the same day."
              next="/upload"
            />
          ) : null}
        </Reveal>

        <aside className="space-y-6">
          <Reveal delay={0.1}>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <WalletIcon size={16} />
                Payout wallet
              </h2>
              {me.payoutVerified ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-[12.5px] font-medium text-success">
                  <CheckIcon size={13} />
                  Verified and receiving
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
                    Nobody can sponsor your work until you verify a Solana address to receive it.
                  </p>
                  <ButtonLink href="/settings" variant="secondary" size="sm" className="mt-4">
                    Add a wallet
                    <ArrowRightIcon size={13} className="nudge-icon" />
                  </ButtonLink>
                </>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.15}>
            <Card className="p-5">
              <h2 className="flex items-baseline justify-between text-[15px] font-semibold">
                Sponsorships
                <span className="font-mono text-[12.5px] font-normal text-fg-muted">
                  {formatSol(me.donationTotalLamports)}
                </span>
              </h2>
              {donations.length === 0 ? (
                <p className="mt-3 text-[13.5px] text-fg-muted">
                  None yet. They appear here the moment they confirm.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {donations.map((d) => (
                    <li key={d.id} className="flex items-start gap-3 py-3">
                      <Avatar name={d.donor?.displayName ?? "Anonymous"} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium">
                          {d.donor?.displayName ?? "Anonymous"}
                        </p>
                        {d.message ? (
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                            {d.message}
                          </p>
                        ) : null}
                        {d.confirmedAt ? (
                          <p className="mt-1 text-[11.5px] text-fg-subtle">
                            {timeAgo(d.confirmedAt)}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-[12.5px] tabular-nums">
                        {formatSol(d.amountLamports)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          {demo ? null : (
            <section>
              <h2 className="text-[15px] font-semibold">Saved</h2>
              <div className="mt-3">
                <SavedList />
              </div>
            </section>
          )}
        </aside>
      </div>
    </Container>
  );
}
