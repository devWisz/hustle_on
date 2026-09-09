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
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Container width="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-[26px] font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Enter your email and we will send you a link. Your account is created the first time you
          open one, so there is nothing separate to sign up for.
        </p>

        <LoginForm next={next} className="mt-8" />

        <div className="mt-8 flex gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <ShieldIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[13px] leading-relaxed text-fg-muted">
            There is no password stored here, so there is none to breach. The link works once and
            expires in fifteen minutes. Sardhana will never ask you for a seed phrase or a private
            key.
          </p>
        </div>
      </div>
    </Container>
  );
}
