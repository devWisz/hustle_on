import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { WalletSignIn } from "@/components/account/wallet-signin";
import { ContinueAsGuest } from "@/components/account/guest-actions";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Container } from "@/components/ui";
import { AlertIcon, ShieldIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Hustle On with your Solana wallet.",
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
      : "Hustle On";

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
              ? "Sponsorships are tied to an account so the creator knows who backed them. "
              : uploading
                ? "Uploads are tied to an account so reviewers can reach you and sponsors can find you. "
                : null}
            Your wallet signs one message. Your account is created the first time you do, so there is
            nothing separate to sign up for.
          </p>

          {viewer.online ? (
            <WalletSignIn next={destination === "/" ? undefined : destination} className="mt-8" />
          ) : (
            <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft p-4 text-[13.5px] leading-relaxed text-warning">
              <AlertIcon size={18} className="mt-0.5 shrink-0" />
              <p>
                Sign-in is unavailable while the API is offline. You can still browse published
                sessions; try again once the API is back.
              </p>
            </div>
          )}

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-[13.5px] font-medium text-fg">Not ready to sign in?</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
              Look around first. Every published session is open to anyone.
            </p>
            <ContinueAsGuest next={destination} className="mt-4" />
          </div>

          <div className="mt-8 flex gap-3 border-t border-border pt-6">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-fg-subtle" />
            <p className="text-[13px] leading-relaxed text-fg-muted">
              No password is stored here, so there is none to breach, and nothing is emailed to you.
              Signing in signs a message — it authorises no transfer and costs nothing. We will never
              ask for a seed phrase or private key.
            </p>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
