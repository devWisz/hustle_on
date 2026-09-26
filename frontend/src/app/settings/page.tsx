import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/data";
import { ProfileForm, SignOutButton, WalletForm } from "@/components/account/settings-forms";
import { DemoGate } from "@/components/demo/demo";
import { DemoNote } from "@/components/demo/tag";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Card, Container, Field, Input, Textarea } from "@/components/ui";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const account = await getAccount();
  if (account === "signin") redirect("/login?next=/settings");
  const { me, demo } = account;

  return (
    <Container width="narrow" className="pt-10 sm:pt-14">
      <p className="text-eyebrow">Account</p>
      <SplitHeading as="h1" onScroll={false} className="text-headline mt-4">
        Settings
      </SplitHeading>

      {demo ? (
        <DemoNote className="mt-8">
          Filled in with a sample account. The fields are read-only because there is no account to
          save them to.
        </DemoNote>
      ) : null}

      <Reveal stagger={0.08} immediate className="mt-8 space-y-5">
        {demo ? (
          <>
            <Card as="section" className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold">Profile</h2>
              <div className="mt-5 space-y-5">
                <Field label="Display name" htmlFor="demo-name">
                  <Input id="demo-name" defaultValue={me.displayName} disabled />
                </Field>
                <Field label="Handle" htmlFor="demo-handle" hint="Your profile lives at /creator/your-handle.">
                  <Input id="demo-handle" defaultValue={me.handle} disabled />
                </Field>
                <Field label="Bio" htmlFor="demo-bio">
                  <Textarea id="demo-bio" rows={3} disabled placeholder="What you work on." />
                </Field>
              </div>
            </Card>
            <Card as="section" className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold">Payout wallet</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
                Sponsorships are sent here directly. Signing one message proves the key is yours and
                moves nothing.
              </p>
              <p className="mt-4 rounded-[var(--radius-control)] border border-dashed border-border-strong px-3.5 py-3 text-[13px] text-fg-subtle">
                No wallet on file. Connecting one happens in your own wallet extension, after you sign in.
              </p>
            </Card>
            <DemoGate
              title="Make it yours"
              body="One email address is the whole sign-up. There is no password to choose."
              next="/settings"
            />
          </>
        ) : (
          <>
            <ProfileForm user={me} />
            <WalletForm user={me} />
            <Card as="section" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="text-[16px] font-semibold">Session</h2>
                <p className="mt-1 text-[13.5px] text-fg-muted">
                  Signed in as {me.email}. Every sign-in is a fresh emailed link.
                </p>
              </div>
              <SignOutButton />
            </Card>
          </>
        )}
      </Reveal>
    </Container>
  );
}
