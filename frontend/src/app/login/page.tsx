import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { EmailAuthForm } from "@/components/account/email-auth-form";
import { WalletSignIn } from "@/components/account/wallet-signin";
import { ContinueAsGuest } from "@/components/account/guest-actions";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Container } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Hustle On with an email address or a Solana wallet.",
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
    <Container width="narrow" className="py-10 sm:py-14">
      <div className="max-w-md">
        <p className="text-eyebrow">{eyebrow}</p>
        <SplitHeading as="h1" onScroll={false} className="text-headline mt-3">
          Sign in
        </SplitHeading>
        <p className="mt-2.5 text-[15px] leading-relaxed text-fg-muted">
          {sponsoring
            ? "Sponsorships are tied to an account so the creator knows who backed them."
            : uploading
              ? "Uploads are tied to an account so reviewers can reach you and sponsors can find you."
              : "One account, whichever way you prefer to sign in."}
        </p>
      </div>

      <Reveal immediate delay={0.15}>
        {viewer.online ? (
          <>
            {/* Two ways in, side by side once there is room for both: on a laptop the
                wallet chooser then sits at the top of the page with the email form,
                rather than below the fold where it has to be scrolled to. Below `lg`
                the grid is one column and the order in the source is the order read. */}
            <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
              {/* Email first in the source: it is the path that needs nothing
                  installed and nothing delivered, so it is the one that always
                  works, and it is the left-hand column on a wide screen. */}
              <EmailAuthForm
                next={destination === "/" ? undefined : destination}
                className="min-w-0"
              />

              <section aria-labelledby="wallet-signin-heading" className="min-w-0">
                <h2 id="wallet-signin-heading" className="text-[13.5px] font-medium text-fg">
                  Use a Solana wallet
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                  Your wallet signs one message. No password, and your address is set up to receive
                  sponsorships straight away.
                </p>
                <WalletSignIn
                  next={destination === "/" ? undefined : destination}
                  className="mt-3"
                />
              </section>
            </div>

            <div className="mt-8 border-t border-border pt-5">
              <p className="text-[13.5px] font-medium text-fg">Just looking?</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                Everything published is open to anyone. Continue as a guest and look around — you
                can read every session, and an account is only needed to upload, sponsor or save.
              </p>
              <ContinueAsGuest next={destination} className="mt-4" />
            </div>
          </>
        ) : (
          <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft p-4 text-[13.5px] leading-relaxed text-warning">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            <p>
              Sign-in is unavailable while the API is offline. You can still browse published
              sessions; try again once the API is back.
            </p>
          </div>
        )}
      </Reveal>
    </Container>
  );
}
