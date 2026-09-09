import type { Metadata } from "next";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

const clauses = [
  {
    title: "Your work stays yours",
    body: "You keep every right to what you publish. You grant Sardhana only the licence needed to host and display it here, and that licence ends when you remove the timelapse.",
  },
  {
    title: "Publish only what is yours to publish",
    body: "Do not upload someone else's recording, work you did not do, or material you do not have the rights to. Presenting another person's work as your own is grounds for removing the timelapse and the account.",
  },
  {
    title: "Every submission is reviewed",
    body: "Nothing reaches the public feed without a person approving it. A submission may be declined, and you will be given a written reason you can act on. A published timelapse may also be taken down later if it turns out to breach these terms.",
  },
  {
    title: "Donations are direct, and final",
    body: "SOL moves from the donor's wallet to the creator's wallet. Sardhana never takes custody of it and charges no fee. Once a Solana transaction is confirmed, nobody — including us — can reverse it. Network fees charged by Solana are separate and are not ours.",
  },
  {
    title: "Your wallet is yours alone",
    body: "We ask you to sign one message to prove you control your payout address. That signature authorises no transfer. We will never ask for a seed phrase or a private key, and any page that does is not ours.",
  },
  {
    title: "No warranty on outcomes",
    body: "Publishing here does not guarantee that anyone will donate, and approval is not an endorsement of the work or a guarantee that it is accurate. Judge what you fund for yourself.",
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
