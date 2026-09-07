import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import { Container } from "@/components/ui";
import { JobForm } from "@/components/job-form";

export const metadata: Metadata = {
  title: "Post a role",
  robots: { index: false, follow: false },
};

export default async function NewJobPage() {
  const session = await apiServer<{ authenticated: boolean }>("/v1/auth/session", 0);
  if (!session?.authenticated) redirect("/login?next=/jobs/new");

  return (
    <Container width="narrow" className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Post a role</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Describe the work. People apply with their published sessions attached, so you can watch
          how they work before you reply.
        </p>
      </header>
      <JobForm />
    </Container>
  );
}
