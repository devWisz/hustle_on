import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { UploadForm } from "@/components/upload-form";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Upload a timelapse" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  if (!me) redirect("/login?next=/upload");

  return (
    <Container width="narrow" className="py-12">
      <h1 className="text-[26px] font-semibold leading-tight">Upload a timelapse</h1>
      <p className="mt-1.5 text-sm text-fg-muted">
        A person reads every submission before it goes up. Expect a decision, not a queue you never
        hear back from.
      </p>

      {!me.payoutVerified ? (
        <Card className="mt-6 p-4">
          <p className="text-[13px] text-fg-muted">
            You have no payout wallet yet. You can still submit — but nobody will be able to donate
            until you verify one in{" "}
            <a href="/settings" className="text-accent underline underline-offset-2">
              settings
            </a>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-8">
        <UploadForm />
      </div>
    </Container>
  );
}
