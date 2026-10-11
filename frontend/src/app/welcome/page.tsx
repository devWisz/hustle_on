import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { OnboardingForm } from "@/components/account/onboarding-form";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The profile step, shown once.
 *
 * Signing in creates an account from a wallet signature: a generated handle and a
 * display name identical to that handle. That is enough to own a session and
 * not enough to be credited for one — the name is on every card, beside every
 * recording, and in the ledger when somebody sponsors the work — so this is where
 * the site stops guessing and asks.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const me = await getAccount();
  if (me === "signin") redirect("/login?next=/welcome");

  // Anything already set up has no business here; sending them on rather than
  // showing the form again is what keeps this a step and not a page of its own.
  if (me.onboarded) redirect(safeNext((await searchParams).next, "/dashboard"));

  const next = safeNext((await searchParams).next, "/dashboard");

  return (
    <Container width="narrow" className="py-14 sm:py-20">
      <p className="text-eyebrow">One thing first</p>
      <h1 className="text-headline mt-4">Your profile</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
        This is what appears beside your work: on every card in the feed, on your session pages, and
        on your creator page. You can change all of it later in settings.
      </p>
      <OnboardingForm next={next} initial={me} />
    </Container>
  );
}
