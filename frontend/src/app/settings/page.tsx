import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { SAMPLE_SELF } from "@/lib/sample";
import { ProfileForm, SignOutButton, WalletForm } from "@/components/settings-forms";
import { GuestGate, SampleNote } from "@/components/guest";
import { Card, Container, Field, Input, Textarea } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  const guest = !me && (await isGuestPreview());
  if (!me && !guest) redirect("/login?next=/settings");

  return (
    <Container width="narrow" className="py-12">
      <p className="text-eyebrow">Account</p>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight">Settings</h1>

      {guest ? (
        <SampleNote className="mt-6">
          Shown filled in with an invented account. The fields are disabled here because there is
          no account to save them to.
        </SampleNote>
      ) : null}

      <div className="mt-8 space-y-6">
        {me ? (
          <>
            <ProfileForm user={me} />
            <WalletForm user={me} />

            <Card as="section" className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h2 className="text-[15px] font-semibold">Account</h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Signed in as {me.email}. Sardhana has no password to change — every sign-in is a
                  fresh emailed link.
                </p>
              </div>
              <SignOutButton />
            </Card>
          </>
        ) : (
          <>
            <ReadOnlyProfile />
            <ReadOnlyWallet />
            <GuestGate
              title="Make it yours"
              body="One email address is the whole sign-up. There is no password to choose, and the profile below is the only thing you are asked to fill in."
              next="/settings"
            />
          </>
        )}
      </div>
    </Container>
  );
}

/**
 * The profile card as a guest sees it.
 *
 * Real controls, disabled, rather than a screenshot: the point is to show
 * exactly what is asked for before somebody commits an email address to
 * finding out, and a picture of a form cannot be read by a screen reader.
 */
function ReadOnlyProfile() {
  return (
    <Card as="section" className="p-5">
      <h2 className="text-[15px] font-semibold">Profile</h2>
      <div className="mt-4 space-y-5">
        <Field label="Display name" htmlFor="preview-name">
          <Input id="preview-name" defaultValue={SAMPLE_SELF.displayName} disabled />
        </Field>
        <Field label="Handle" htmlFor="preview-handle" hint="Your profile lives at /creator/your-handle.">
          <Input id="preview-handle" defaultValue={SAMPLE_SELF.handle} disabled />
        </Field>
        <Field label="Bio" htmlFor="preview-bio">
          <Textarea
            id="preview-bio"
            rows={3}
            disabled
            defaultValue=""
            placeholder="What you work on."
          />
        </Field>
      </div>
    </Card>
  );
}

function ReadOnlyWallet() {
  return (
    <Card as="section" className="p-5">
      <h2 className="text-[15px] font-semibold">Payout wallet</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
        Donations are sent here directly. Sardhana never holds them and never asks for a seed
        phrase — signing one message proves the key is yours and moves nothing.
      </p>
      <p className="mt-4 rounded-[var(--radius-control)] border border-dashed border-border-strong px-3 py-2.5 text-[13px] text-fg-subtle">
        No wallet on file. Connecting one happens in your own wallet extension, after you sign in.
      </p>
    </Card>
  );
}
