import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/data";
import { UploadForm } from "@/components/account/upload-form";
import { DemoNote } from "@/components/demo/tag";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Container } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Upload a timelapse", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CHECKLIST = [
  "Say what you were trying to do, and what changed",
  "Mention what went wrong, not only what worked",
  "Link the repo, commit or post a reviewer can check",
  "Give the real session length, not the clip length",
];

export default async function UploadPage() {
  const account = await getAccount();
  if (account === "signin") redirect("/login?next=/upload");
  const { me, demo } = account;

  return (
    <Container width="wide" className="pt-10 sm:pt-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <div className="min-w-0">
          <p className="text-eyebrow">Submit</p>
          <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
            Upload a timelapse
          </SplitHeading>
          <Reveal immediate delay={0.2}>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
              A person reads every submission before it goes up. Expect a decision, with a reason if
              it is not a yes.
            </p>
          </Reveal>

          {demo ? (
            <DemoNote className="mt-8">
              This is the real form. Fill it in as far as you like; submitting needs an account.
            </DemoNote>
          ) : !me.payoutVerified ? (
            <p className="mt-8 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning">
              You have no payout wallet yet. You can still submit, but nobody can sponsor you until you
              verify one in{" "}
              <Link href="/settings" className="font-medium text-fg underline underline-offset-2">
                settings
              </Link>
              .
            </p>
          ) : null}

          <Reveal immediate delay={0.25} className="mt-8">
            <UploadForm preview={demo} />
          </Reveal>
        </div>

        <aside className="lg:pt-24">
          <Reveal immediate delay={0.35} className="rounded-[var(--radius-card)] border border-border bg-surface p-6 lg:sticky lg:top-24">
            <p className="text-eyebrow">What reviewers look for</p>
            <ul className="mt-5 space-y-4">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-fg-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <CheckIcon size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-border pt-5 text-[13px] leading-relaxed text-fg-subtle">
              Most decisions land within a day. If it comes back, the note tells you exactly what to
              fix.
            </p>
          </Reveal>
        </aside>
      </div>
    </Container>
  );
}
