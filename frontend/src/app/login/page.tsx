import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { EnterGuestButton } from "@/components/guest";
import { isGuestPreview } from "@/lib/guest-server";
import { safeNext } from "@/lib/guest";
import { CheckIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Sardhana with an email link.",
  robots: { index: false, follow: false },
};

/** What a preview actually opens up, said plainly rather than promised vaguely. */
const PREVIEW_INCLUDES = [
  "The feed, a watch page and a creator profile",
  "The creator dashboard, with a decision on every submission",
  "The submission form and the account settings",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  const guest = await isGuestPreview();

  return (
    <Container className="py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        <div className="animate-fade-in-up">
          <p className="text-eyebrow">Sardhana</p>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Enter your email and we will send you a link. Your account is created the first time you
            open one, so there is nothing separate to sign up for.
          </p>

          <LoginForm next={next} className="mt-8" />

          <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-[13px] leading-relaxed text-fg-muted">
              There is no password stored here, so there is none to breach. The link works once and
              expires in fifteen minutes. Sardhana will never ask you for a seed phrase or a private
              key.
            </p>
          </div>
        </div>

        {/* The other half of the offer. Somebody who arrived at a sign-in form
            they did not ask for should be able to go and look first. */}
        <div className="animate-fade-in-up delay-2 lg:border-l lg:border-border lg:pl-20">
          <p className="text-eyebrow">Or don&rsquo;t, yet</p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight">
            Look around without an account
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
            Guest preview opens every screen in the product, filled in with sample records so there
            is something to look at. Nothing is saved and nothing is sent.
          </p>

          <ul className="mt-6 space-y-2.5">
            {PREVIEW_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] text-fg-muted">
                <CheckIcon size={15} className="mt-0.5 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7">
            {guest ? (
              <p className="text-sm text-fg-muted">
                You are already previewing.{" "}
                <Link href="/" className="link-underline text-fg">
                  Back to the feed
                </Link>
                .
              </p>
            ) : (
              <EnterGuestButton
                next={destination === "/login" ? "/" : destination}
                label="Start a guest preview"
                size="lg"
                withIcon
                className="w-full sm:w-auto"
              />
            )}
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-fg-subtle">
            Writing anything — a submission, a profile, a donation — still needs an account, because
            it has to belong to somebody a reviewer can write back to.
          </p>
        </div>
      </div>
    </Container>
  );
}
