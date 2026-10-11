import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "The rules for recording, uploading, reviewing and sponsoring work on Hustle On.",
};

const sections = [
  {
    title: "What Hustle On is",
    body: "Hustle On is a place to show the work behind a project. You record yourself working, turn the recording into a timelapse, and upload it with a written account of what you did. A Hustle On reviewer reads every submission before it is published. Once it is live, anyone can watch it and, if they choose, sponsor you by sending SOL straight to your wallet or get in touch to hire you. These terms cover every part of that, and by creating an account or using the site you agree to them.",
  },
  {
    title: "Who can use it",
    body: "You must be at least 18 years old, or the age of majority where you live if that is higher, to create an account, upload, or send or receive sponsorships. One account per person. You are responsible for everything done through your account, so keep access to your wallet secure: signing in is a signature from it, and anyone holding your seed phrase or private key can sign in as you.",
  },
  {
    title: "Recording yourself",
    body: "You are responsible for everything that appears in your recording. Before you upload, check that it does not show passwords, API keys, private keys, seed phrases, customer data, or anything covered by an employer agreement or a non-disclosure agreement you are bound by. Do not record other people, their screens or their messages without their permission. If you record work you do for an employer or a client, make sure you are allowed to publish it.",
  },
  {
    title: "What you may upload",
    body: "Only recordings of work you actually did, during the session you describe. The write-up must be honest about what was done, what went wrong and what the result was, and the session length you give must be the real time spent working, not the length of the clip. Links to a repository or post must point at the work in the recording. Presenting someone else's work as yours, faking a session, or padding the length is grounds for removal and for closing the account.",
  },
  {
    title: "Review and approval",
    body: "Nothing is published automatically. A reviewer compares your write-up with your recording and either approves it or sends it back with a written reason you can act on. You can fix a submission and resubmit it. Approval means the submission met these rules at the time of review; it is not an endorsement of the work, its quality or its accuracy. A published timelapse can be taken down later if it turns out to break these terms, and every review decision is recorded in an audit trail.",
  },
  {
    title: "Content that is not allowed",
    body: "Anything illegal where you or we operate; harassment, hate or threats; sexual content; graphic violence; malware or instructions for attacking systems you do not own; spam, scams or misleading claims; impersonation of another person or organisation; and fundraising for anything unlawful. Reviewers may decline or remove content that falls under any of these without further notice.",
  },
  {
    title: "Your rights in your work",
    body: "You keep ownership of everything you upload. You give Hustle On a worldwide, non-exclusive, royalty-free licence to store, process, display and stream it on the site, and to show short excerpts and thumbnails when promoting the site, for as long as the timelapse is published. The licence ends when you remove the timelapse, apart from copies that are already cached or in backups, which expire on their normal schedule.",
  },
  {
    title: "Sponsorships",
    body: "A sponsorship is a voluntary gift of SOL from a viewer's wallet to the creator's verified payout wallet. It is not a purchase, it does not buy any product, service or reward unless the creator separately promises one, and Hustle On is not a party to it. Hustle On never holds the funds and takes no fee; Solana network fees are paid by the sender. Confirmed transactions cannot be reversed by anyone, including us, so check the amount and recipient in your wallet before approving. Creators are responsible for any tax due on what they receive.",
  },
  {
    title: "Wallets and security",
    body: "To receive sponsorships you verify a Solana address by signing a message. That signature proves you control the address and authorises no transfer. Hustle On will never ask for your seed phrase or private key; any page or message that does is not us. You are responsible for the security of your wallet.",
  },
  {
    title: "Hiring and offers",
    body: "If someone contacts you about paid work after watching your session, any agreement is between the two of you. Hustle On does not verify offers, is not an employer or agent, and is not responsible for arrangements made off the site.",
  },
  {
    title: "Suspension and closing accounts",
    body: "We may suspend or close an account that breaks these terms, attempts to abuse the review process, or puts other users at risk. You can stop using Hustle On and ask for your account to be deleted at any time. Removing an account removes its published timelapses from the site; transactions already settled on the chain remain there.",
  },
  {
    title: "No warranty and limited liability",
    body: "Hustle On is provided as it is and as available. We do not promise that the site will always be online, that any upload will be approved, or that anyone will sponsor you. To the fullest extent the law allows, Hustle On is not liable for indirect or consequential losses, for lost funds caused by wallet mistakes or compromised keys, or for arrangements users make with each other.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these terms as the product changes. When the change is material, we will say so on the site before it takes effect. Continuing to use Hustle On after that means you accept the updated terms.",
  },
  {
    title: "Contact",
    body: "Questions about these terms, or a report about content on the site, go to support@hustleon.com.",
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms and Conditions"
      updated="September 26, 2026"
      intro="Plain language, and binding. They cover the whole workflow: recording yourself, uploading the timelapse, review, and sponsorship."
      sections={sections}
      footer={
        <p>
          How we handle your data is described in the{" "}
          <Link href="/privacy" className="font-medium text-fg underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      }
    />
  );
}
