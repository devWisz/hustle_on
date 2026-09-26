import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/account/verify-client";
import { Container, Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <Container width="narrow" className="py-24">
      <Suspense fallback={<Spinner label="Signing you in" />}>
        <VerifyClient />
      </Suspense>
    </Container>
  );
}
