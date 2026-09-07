import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Security",
  description: "How Sardhana handles accounts, money and your work.",
};

const sections = [
  {
    title: "There is no password to steal",
    body: "Signing in sends a single-use link to your email. We store no password hash, so a database breach yields no credential to crack or reuse. The link expires in fifteen minutes and works exactly once.",
  },
  {
    title: "Sessions are opaque and revocable",
    body: "Your session cookie is a random token; only its hash is stored. The cookie is HttpOnly, so no script on the page can read it, Secure, so it never crosses a plaintext connection, and SameSite=Lax, so another site cannot make your browser use it. Suspending an account revokes every live session immediately.",
  },
  {
    title: "We never take custody of your funds",
    body: "Sponsorships go from the sponsor's wallet to the creator's wallet. Hire engagements sit in an on-chain escrow whose only exits are a release the client signs and a refund after the deadline. The platform fee is capped in the program itself at ten percent, so no configuration change can exceed it.",
  },
  {
    title: "Every payment is verified against the chain",
    body: "A signature reported by a browser is treated as a hint, not as proof. Before any earned total moves we fetch the finalized transaction from the cluster and check that the balances actually moved between the expected accounts. If the confirmation never reaches us, a background reconciler settles it, so a closed tab cannot cost a creator their money.",
  },
  {
    title: "Wallets are proven, not claimed",
    body: "Attaching a wallet requires signing a nonce we issue. The message is rebuilt on our side before the signature is checked, so a signature captured elsewhere cannot be replayed here. Signing it authorises no transfer. We will never ask you for a seed phrase or a private key, and any page that does is not us.",
  },
  {
    title: "Uploads cannot become attacks",
    body: "Video files go straight from your browser to object storage using a short-lived URL we sign for one specific object under your own prefix. Only video content types are accepted, and the type is part of the signature, so a file cannot be relabelled into something a browser would execute.",
  },
] as const;

export default function SecurityPage() {
  return (
    <Container width="narrow" className="py-14 sm:py-20">
      <header className="max-w-xl">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldIcon size={20} />
        </span>
        <h1 className="mt-5 text-[28px] font-semibold tracking-tight">Security</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
          People publish their work and their income here. This page states plainly what we do to
          protect both, in enough detail to be checked rather than taken on trust.
        </p>
      </header>

      <div className="mt-10 space-y-4">
        {sections.map((section) => (
          <Card key={section.title} className="p-6">
            <h2 className="text-[16px] font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{section.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-[16px] font-semibold">Reporting a vulnerability</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Send findings to{" "}
          <a href="mailto:security@sardhana.com" className="font-medium text-fg underline underline-offset-4">
            security@sardhana.com
          </a>
          . We aim to acknowledge within one business day. Please do not test against other
          people&apos;s accounts or funds; if you need an account to test with, ask and we will set
          one up.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          The Solana program is open for review in the repository, and the details of the escrow
          rules are documented alongside it.{" "}
          <Link href="/terms" className="font-medium text-fg underline underline-offset-4">
            Terms
          </Link>
        </p>
      </Card>
    </Container>
  );
}
