import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { VerifyClient } from "@/components/verify-client";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <Container width="narrow" className="py-24">
      <Suspense fallback={<p className="text-sm text-fg-muted">Signing you in…</p>}>
        <VerifyClient />
      </Suspense>
    </Container>
  );
}
