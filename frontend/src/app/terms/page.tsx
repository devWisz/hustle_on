import type { Metadata } from "next";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

const clauses = [
  {
    title: "Your work stays yours",
    body: "You keep every right to what you publish. You grant Sardhana only the licence needed to host, transcode and display it on the platform, and that licence ends when you remove the content.",
  },
  {
    title: "Publish only what is yours to publish",
    body: "Do not upload someone else's recording, work you did not do, or material you do not have the rights to. Presenting another person's work as your own is grounds for removal of the content and the account.",
  },
  {
    title: "Payments are final once confirmed",
    body: "Sponsorships settle on the Solana blockchain. Once a transaction is confirmed it cannot be reversed by us or by anyone else. Escrowed engagements follow the rules written into the program: milestones release on the client's signature, and unreleased funds return to the client after the deadline.",
  },
  {
    title: "Fees",
    body: "The platform fee is shown before you confirm any payment and is capped in the on-chain program at ten percent. Network fees charged by Solana are separate and are not ours.",
  },
  {
    title: "Moderation",
    body: "Content that is illegal, harassing, sexual, or misrepresented as someone else's work will be removed. Accounts that repeat this will be suspended. Every moderation decision is recorded in an audit log.",
  },
  {
    title: "No warranty on outcomes",
    body: "Publishing here does not guarantee sponsorship or employment, and we do not vouch for any client or creator. Verify who you are dealing with before you commit money or time.",
  },
] as const;

export default function TermsPage() {
  return (
    <Container width="narrow" className="py-14 sm:py-20">
      <h1 className="text-[28px] font-semibold tracking-tight">Terms</h1>
      <p className="mt-3 text-sm text-fg-muted">
        Plain language, and binding. If something here is unclear, ask before you rely on it.
      </p>

      <ol className="mt-10 space-y-8">
        {clauses.map((clause, index) => (
          <li key={clause.title}>
            <h2 className="text-[16px] font-semibold">
              <span className="mr-2 tabular-nums text-fg-subtle">{index + 1}.</span>
              {clause.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{clause.body}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
