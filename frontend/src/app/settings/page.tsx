import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser, Wallet } from "@/lib/types";
import { Container } from "@/components/ui";
import {
  AccountSettings,
  ProfileSettings,
  SocialSettings,
  WalletSettings,
} from "@/components/settings-forms";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export default async function SettingsPage() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  if (!session?.authenticated || !session.user) redirect("/login?next=/settings");

  const wallets = await apiServer<{ wallets: Wallet[] }>("/v1/me/wallets", 0);

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="space-y-6">
        <ProfileSettings user={session.user} />
        <WalletSettings wallets={wallets?.wallets ?? []} />
        <SocialSettings user={session.user} />
        <AccountSettings user={session.user} />
      </div>
    </Container>
  );
}
