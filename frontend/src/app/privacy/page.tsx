import type { Metadata } from "next";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

const sections = [
  {
    title: "What we collect",
    body: "Your email address, the profile and content you choose to publish, the wallet addresses you attach, and coarse technical data needed to keep the service running — the address a request came from and the browser it came from, retained for rate limiting and abuse investigation.",
  },
  {
    title: "What we do not collect",
    body: "No passwords, because there are none. No private keys or seed phrases, ever. No third-party advertising or analytics trackers, and no cross-site profiling.",
  },
  {
    title: "View counts",
    body: "Views are deduplicated using a salted, one-way digest of your address, browser and the day — not the values themselves. It is enough to stop a refresh loop inflating a count, and not enough to identify you.",
  },
  {
    title: "What is public",
    body: "Your handle, display name, profile, published sessions, comments, and the total you have been sponsored. Sponsorships you send anonymously do not show your name to anyone, including the creator.",
  },
  {
    title: "What is on chain",
    body: "Transactions are permanent and public by the nature of a blockchain. Amounts, wallet addresses and timestamps are visible to anyone. Sponsorship messages are stored in our database, and only a hash of the message reaches the chain.",
  },
  {
    title: "Deletion",
    body: "You can remove any session at any time. Deleting your account removes your profile, content and email from the database; transactions already settled on chain cannot be deleted by anyone.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <Container width="narrow" className="py-14 sm:py-20">
      <h1 className="text-[28px] font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 text-sm text-fg-muted">
        The short version: we hold as little as the service can function with.
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-[16px] font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-fg-muted">
        Questions about your data go to{" "}
        <a href="mailto:privacy@sardhana.com" className="font-medium text-fg underline underline-offset-4">
          privacy@sardhana.com
        </a>
        .
      </p>
    </Container>
  );
}
