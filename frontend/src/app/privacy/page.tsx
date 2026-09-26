import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Privacy" };

const sections = [
  {
    title: "What we collect",
    body: "Your email address, the profile and timelapses you choose to publish, the wallet address you verify for payouts, and coarse technical data needed to keep the service running — the address a request came from and the browser it came from, kept for rate limiting and abuse investigation.",
  },
  {
    title: "What we do not collect",
    body: "No passwords, because there are none. No private keys or seed phrases, ever. No third-party advertising or analytics trackers, and no cross-site profiling.",
  },
  {
    title: "View counts",
    body: "Views are deduplicated using a one-way digest of your address salted with the day, not the address itself. That is enough to stop a refresh loop inflating a count, and not enough to identify you or to link what you watched today with what you watch tomorrow.",
  },
  {
    title: "What is public",
    body: "Your handle, display name, bio, published timelapses, payout address, and the total you have received. A donation you send while signed out shows no name at all.",
  },
  {
    title: "What is on chain",
    body: "Donations are Solana transactions, which are permanent and public by nature. Amounts, wallet addresses and timestamps are visible to anyone, forever. The message attached to a donation is stored in our database and never sent to the chain.",
  },
  {
    title: "Deletion",
    body: "You can withdraw any timelapse at any time. Deleting your account removes your profile, your email and your content from the database. Transactions already settled on chain cannot be deleted by anyone.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      intro="The short version: we hold as little as the service can function with."
      sections={sections}
      footer={
        <p>
          Questions about your data go to{" "}
          <a href="mailto:privacy@sardhana.com" className="font-medium text-fg underline underline-offset-4">
            privacy@sardhana.com
          </a>
          .
        </p>
      }
    />
  );
}
