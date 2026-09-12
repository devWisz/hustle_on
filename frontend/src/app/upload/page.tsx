import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { isGuestPreview } from "@/lib/guest-server";
import { UploadForm } from "@/components/upload-form";
import { GuestGate, SampleNote } from "@/components/guest";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Upload a timelapse" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const me = await apiServer<SelfUser>("/v1/me", 0);
  const guest = !me && (await isGuestPreview());
  if (!me && !guest) redirect("/login?next=/upload");

  return (
    <Container width="narrow" className="py-12">
      <p className="text-eyebrow">Submit</p>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight">Upload a timelapse</h1>
      <p className="mt-1.5 text-sm text-fg-muted">
        A person reads every submission before it goes up. Expect a decision, not a queue you never
        hear back from.
      </p>

      {guest ? (
        <>
          <SampleNote className="mt-6">
            The form below is the real one, filled in as far as you like. Submitting needs an
            account, because a submission has to belong to somebody a reviewer can write back to.
          </SampleNote>
          <GuestGate
            className="mt-4"
            title="Ready to send one in?"
            body="Sign in with an email link and this same form becomes live. Your draft is not kept, so it is worth doing that part first."
            next="/upload"
          />
        </>
      ) : me && !me.payoutVerified ? (
        <Card className="mt-6 p-4">
          <p className="text-[13px] text-fg-muted">
            You have no payout wallet yet. You can still submit — but nobody will be able to donate
            until you verify one in{" "}
            <Link href="/settings" className="text-accent underline underline-offset-2">
              settings
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-8">
        <UploadForm preview={guest} />
      </div>
    </Container>
  );
}
