"use client";

import { useRouter } from "next/navigation";
import { endGuestSession, startGuestSession } from "@/lib/guest";
import { Button, type ButtonProps } from "../ui";

/**
 * The way in for somebody who is not ready to sign in.
 *
 * It sets a preference cookie so the site stops asking, and takes them where
 * they were going. It grants nothing: everything that needs an account still
 * says so and still refuses.
 */
export function ContinueAsGuest({
  next = "/",
  label = "Continue as guest",
  variant = "secondary",
  size = "md",
  className,
}: {
  next?: string;
  label?: string;
} & Pick<ButtonProps, "variant" | "size"> & { className?: string }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        startGuestSession();
        router.push(next);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

/**
 * The way out of guest mode, for somebody who has decided to make an account.
 *
 * It forgets the preference before sending them to sign in, so a later visit to
 * a gated page asks properly instead of explaining the guest rules again.
 */
export function SignInFromGuest({ next, className }: { next?: string; className?: string }) {
  const router = useRouter();
  const target = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <Button
      className={className}
      onClick={() => {
        endGuestSession();
        router.push(target);
      }}
    >
      Sign in
    </Button>
  );
}
