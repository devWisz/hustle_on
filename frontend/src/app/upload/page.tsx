import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { Container } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";

export const metadata: Metadata = {
  title: "Publish a session",
  robots: { index: false, follow: false },
};

interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}

export default async function UploadPage() {
  const session = await apiServer<SessionResponse>("/v1/auth/session", 0);
  // Server-side guard. The API enforces this too; doing it here means an
  // unauthenticated visitor never sees a form they cannot submit.
  if (!session?.authenticated) redirect("/login?next=/upload");

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Publish a session</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Upload the timelapse, say what the session was, and it goes on your public record.
        </p>
      </header>
      <UploadForm />
    </Container>
  );
}
