import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { LoginForm } from "@/components/account/login-form";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Container } from "@/components/ui";
import { AlertIcon, ShieldIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Sardhana with an email link.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  const viewer = await getViewer();
  const sponsoring = destination.startsWith("/watch/") && destination.endsWith("#sponsor");
  const uploading = destination.startsWith("/upload");
  const eyebrow = sponsoring
    ? "One step before you sponsor"
    : uploading
      ? "One step before you upload"
      : "Sardhana";

  return (
    <Container width="narrow" className="py-14 sm:py-24">
      <div className="max-w-md">
        <p className="text-eyebrow">{eyebrow}</p>
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
            Enter your email and we send you a link. Your account is created the first time you open
            one, so there is nothing separate to sign up for.
          </p>

          {viewer.online ? (
            <LoginForm next={destination === "/" ? undefined : destination} className="mt-8" />
          ) : (
            <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft p-4 text-[13.5px] leading-relaxed text-warning">
              <AlertIcon size={18} className="mt-0.5 shrink-0" />
              <p>
                Sign-in is unavailable while the API is offline. You can still browse published
                sessions; try again once the API is back.
              </p>
            </div>
          )}

          <div className="mt-8 flex gap-3 border-t border-border pt-6">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-fg-subtle" />
            <p className="text-[13px] leading-relaxed text-fg-muted">
              No password is stored here, so there is none to breach. The link works once and expires
              in fifteen minutes. We will never ask for a seed phrase or private key.
            </p>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
