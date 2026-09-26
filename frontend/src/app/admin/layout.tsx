import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/data";
import { AdminNav } from "@/components/admin/nav";
import { DemoTag } from "@/components/demo/tag";
import { Avatar, Container } from "@/components/ui";
import { ShieldIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin — Sardhana" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAdmin();
  if (data === "signin") redirect("/login?next=/admin");
  if (data === "forbidden") notFound();

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
            }}
          />
          {data.demo ? (
            <p className="mt-5 hidden rounded-[var(--radius-control)] border border-border p-3 text-[12px] leading-relaxed text-fg-muted lg:block">
              <DemoTag className="mb-2" />
              <br />
              Sample data. Decisions change this view only and are never sent anywhere.
            </p>
          ) : null}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
