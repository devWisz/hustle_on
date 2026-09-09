import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { ProfileForm, SignOutButton, WalletForm } from "@/components/settings-forms";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  if (!me) redirect("/login?next=/settings");

  return (
    <Container width="narrow" className="py-12">
      <h1 className="text-[26px] font-semibold leading-tight">Settings</h1>

      <div className="mt-8 space-y-6">
        <ProfileForm user={me} />
        <WalletForm user={me} />

        <Card as="section" className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Account</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Signed in as {me.email}. Sardhana has no password to change — every sign-in is a fresh
              emailed link.
            </p>
          </div>
          <SignOutButton />
        </Card>
      </div>
    </Container>
  );
}
