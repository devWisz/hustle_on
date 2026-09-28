import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/data";
import { safeNext } from "@/lib/demo/cookie";
import { LoginForm } from "@/components/account/login-form";
import { EnterDemoButton } from "@/components/demo/demo";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { ButtonLink, Container } from "@/components/ui";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Sardhana with an email link.",
  robots: { index: false, follow: false },
};

const DEMO_INCLUDES = [
  "The feed, watch pages and creator profiles",
  "A creator dashboard with a decision on every submission",
  "Account settings and the upload form, exactly as creators see them",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  const viewer = await getViewer();
  const sponsoring = destination.startsWith("/watch/");
  const uploading = destination.startsWith("/upload");

  return (
    <Container width="wide" className="py-14 sm:py-24">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-24">
        <div className="max-w-md">
          <p className="text-eyebrow">
            {sponsoring ? "One step before you sponsor" : uploading ? "One step before you upload" : "Sardhana"}
          </p>
          <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
            Sign in or create an account
          </SplitHeading>
          <Reveal immediate delay={0.2}>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
              {sponsoring
                ? "Sponsorships are tied to an account, so the creator knows who backed them and every transfer can be verified. "
                : uploading
                  ? "Uploads are tied to an account so reviewers can reach you and sponsors can find you. "
                  : null}
              Enter your email and we send you a link. Your account is created the first time you
              open one, so there is nothing separate to sign up for.
            </p>

            {viewer.online ? (
              <LoginForm next={destination === "/" ? undefined : destination} className="mt-8" />
            ) : (
              <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft p-4 text-[13.5px] leading-relaxed text-warning">
                <AlertIcon size={18} className="mt-0.5 shrink-0" />
                <p>
                  Sign-in is unavailable while the API is offline. Everything else still works in
                  demo mode.
                </p>
              </div>
            )}

            <div className="mt-8 flex gap-3 border-t border-border pt-6">
              <ShieldIcon size={18} className="mt-0.5 shrink-0 text-fg-subtle" />
              <p className="text-[13px] leading-relaxed text-fg-muted">
                No password is stored here, so there is none to breach. The link works once and
                expires in fifteen minutes. We will never ask for a seed phrase or private key.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal
          immediate
          delay={0.3}
          className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-10"
        >
          <p className="text-eyebrow">Or look around first</p>
          <h2 className="text-title mt-4">Explore the whole product without an account</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
            Demo mode opens every screen, filled with sample data and real demo videos. Nothing is
            saved and nothing is sent.
          </p>
          <ul className="mt-7 space-y-3">
            {DEMO_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[14.5px] text-fg-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckIcon size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-9">
            {viewer.demo ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/dashboard" size="lg" className="w-full sm:w-auto">
                  Open the dashboard
                </ButtonLink>
              </div>
            ) : (
              <EnterDemoButton
                next={destination === "/login" ? "/" : destination}
                label="Start the demo"
                variant="inverse"
                className="w-full sm:w-auto"
              />
            )}
          </div>
          {viewer.demo ? (
            <p className="mt-5 text-[13px] text-fg-subtle">
              You are already in demo mode.{" "}
              <Link href="/" className="link-underline text-fg-muted">
                Back to the feed
              </Link>
            </p>
          ) : null}
        </Reveal>
      </div>
    </Container>
  );
}
