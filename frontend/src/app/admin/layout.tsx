import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/data";
import { AdminNav } from "@/components/admin/nav";
import { SignOutButton } from "@/components/account/settings-forms";
import { Avatar, ButtonLink, Container } from "@/components/ui";
import { ShieldIcon } from "@/components/ui/icons";
import type { AdminAccess } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin — Sardhana" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAdmin();
  if (data === "forbidden") notFound();
  if (data === "reauth_required" || data === "network_blocked") return <AdminLocked reason={data} />;
  if (typeof data === "string") notFound();

  return (
    <Container width="wide" className="pt-8 sm:pt-10">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-5 hidden items-center gap-3 lg:flex">
            <Avatar name={data.operator.displayName} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold">{data.operator.displayName}</p>
              <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
                <ShieldIcon size={12} />
                Operator
              </p>
            </div>
          </div>
          <AdminNav
            counts={{
              queue: data.queue.length,
              library: data.library.length,
              members: data.members.length || undefined,
              ledger: data.ledger.length || undefined,
              notes: data.notes.length || undefined,
            }}
          />
          <div className="mt-6 hidden lg:block">
            <SignOutButton everywhere />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}

function AdminLocked({ reason }: { reason: Exclude<AdminAccess, "ok"> }) {
  const stale = reason === "reauth_required";
  return (
    <Container width="narrow" className="py-20 sm:py-28">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <ShieldIcon size={20} />
      </span>
      <h1 className="text-title mt-6">
        {stale ? "Sign in again to continue" : "Not available from this network"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
        {stale
          ? "The admin console only accepts recent sign-ins. Request a fresh link and you will land back here."
          : "The admin console is limited to approved networks. Connect from one of them and reload."}
      </p>
      {stale ? (
        <ButtonLink href="/login?next=/admin" className="mt-8">
          Get a fresh sign-in link
        </ButtonLink>
      ) : null}
    </Container>
  );
}
