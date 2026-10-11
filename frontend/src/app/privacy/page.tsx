import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Hustle On collects, why, who processes it, and how long it is kept.",
};

const sections = [
  {
    title: "The short version",
    body: "We collect as little as the service needs to work: an email address to sign you in, the recordings and write-ups you choose to submit, and the wallet address you verify to receive sponsorships. We do not sell data, we do not run advertising trackers, and we never ask for keys or passwords.",
  },
  {
    title: "What we collect",
    body: "Your email address; your handle, display name and bio; the recordings, thumbnails, write-ups, links and session lengths you submit; the Solana address you verify for payouts; notes you post and bookmarks you save; and technical data needed to run and protect the service, namely the IP address and browser a request came from, used for rate limiting, security and abuse investigation.",
  },
  {
    title: "Your recordings",
    body: "A recording you upload is stored privately and seen only by reviewers until it is approved. Once approved it is public: anyone can watch it and see its write-up. Because the recording is of you working, check what is on screen before you upload. We cannot un-publish something that has already been copied by a viewer.",
  },
  {
    title: "How we use it",
    body: "To sign you in, to show your profile and published work, to let reviewers make decisions and keep a record of them, to verify sponsorships against the Solana chain, to send the sign-in emails the service needs, and to prevent abuse. Review decisions are shown on your dashboard rather than emailed. We do not use your data for advertising or sell it to anyone.",
  },
  {
    title: "What we never collect",
    body: "Passwords, because there are none. Private keys or seed phrases, ever. Third-party advertising or cross-site tracking data.",
  },
  {
    title: "Cookies and local storage",
    body: "A session cookie keeps you signed in and a companion cookie protects forms against cross-site requests; both are essential and set only when you sign in. If you choose to browse as a guest, one more cookie records that choice for twelve hours so the site stops asking you to sign in; it grants no access and is forgotten if you sign in or choose essential cookies only. Your theme choice, recent searches and, when signed out, your bookmarks are kept in your own browser's storage and never sent to us. There are no advertising or analytics cookies. Each one is listed in the Cookie Policy, and you choose whether preferences are remembered.",
  },
  {
    title: "View counts",
    body: "Views are deduplicated with a one-way digest of your address salted with the day, not the address itself. That stops a refresh loop from inflating a count without letting anyone identify you or link what you watched on different days.",
  },
  {
    title: "What is public",
    body: "Your handle, display name, bio, published timelapses and their write-ups, your payout address, the notes you post, and the totals you have received. A sponsorship sent while signed out shows no name.",
  },
  {
    title: "What is on the chain",
    body: "Sponsorships are Solana transactions, which are public and permanent. Amounts, wallet addresses and timestamps can be seen by anyone, forever. The message attached to a sponsorship is stored in our database, not on the chain.",
  },
  {
    title: "Who processes data for us",
    body: "Our database is hosted by Neon. Recordings are kept with an object storage provider. Sign-in emails are sent through Resend. Sponsorships are verified through a Solana RPC provider. Each receives only what it needs to do its part and is not allowed to use it for anything else.",
  },
  {
    title: "How long we keep it",
    body: "Sign-in links expire after fifteen minutes and sessions after thirty days; expired links, sessions and wallet challenges are deleted a month after they stop working. Your account and content are kept until you delete them. The review audit trail is kept for as long as the service runs, because it is the record of who approved what.",
  },
  {
    title: "Your choices and rights",
    body: "You can edit your profile, withdraw any timelapse, and delete your account at any time. Deleting an account removes your email, profile and content from the database; audit entries keep the decision but lose the link to your account. Depending on where you live you may also have the right to a copy of your data or to object to how it is used; write to us and we will answer within thirty days.",
  },
  {
    title: "Security",
    body: "Sign-in tokens and sessions are stored only as hashes, every state-changing request is protected against cross-site forgery, and administrative actions are restricted to reviewers and logged. No system is perfectly secure; if we learn of a breach that affects you, we will tell you.",
  },
  {
    title: "Children",
    body: "Hustle On is not for anyone under 18, and we do not knowingly collect data from children. If you believe a child has an account, tell us and we will remove it.",
  },
  {
    title: "Changes",
    body: "If this policy changes in a way that matters, we will say so on the site before the change takes effect.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="September 26, 2026"
      intro="What we collect, why we collect it, who processes it, and how long it is kept."
      sections={sections}
      footer={
        <p>
          Questions about your data go to{" "}
          <a
            href="mailto:privacy@hustleon.com"
            className="font-medium text-fg underline underline-offset-4"
          >
            privacy@hustleon.com
          </a>
          . The rules for using the site are in the{" "}
          <Link href="/terms" className="font-medium text-fg underline underline-offset-4">
            Terms and Conditions
          </Link>
          .
        </p>
      }
    />
  );
}
