import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/data";
import { ProfileForm, SignOutButton, WalletForm } from "@/components/account/settings-forms";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getAccount();
  if (me === "signin") redirect("/login?next=/settings");

  return (
    <Container width="narrow" className="pt-10 sm:pt-14">
      <p className="text-eyebrow">Account</p>
      <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
        Settings
      </SplitHeading>

      <Reveal stagger={0.08} immediate className="mt-8 space-y-5">
        <ProfileForm user={me} />
        <WalletForm user={me} />
        <Card
          as="section"
          className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <h2 className="text-[16px] font-semibold">Session</h2>
            <p className="mt-1 text-[13.5px] text-fg-muted">
              Signed in as {me.email}. If you used a shared or lost device, sign out everywhere to
              end every session at once.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SignOutButton />
            <SignOutButton everywhere />
          </div>
        </Card>
      </Reveal>
    </Container>
  );
}
