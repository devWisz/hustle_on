import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Sardhana with an email link.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const starting = params.intent === "start";

  return (
    <Container width="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-[26px] font-semibold tracking-tight">
          {starting ? "Create your profile" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {starting
            ? "Enter your email and we will send a link. Your profile is created the first time you open it."
            : "Enter your email and we will send you a link. No password to remember or leak."}
        </p>

        <LoginForm next={params.next} className="mt-8" />

        <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <ShieldIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[13px] leading-relaxed text-fg-muted">
            We never store a password, so there is none to breach. The link works once, expires in
            fifteen minutes, and we will never ask you for a seed phrase or a private key.
          </p>
        </div>
      </div>
    </Container>
  );
}
