import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api";
import type { SelfUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Strict RBAC Boundary for /admin/*:
 * Any visitor without verified admin or moderator privileges triggers notFound(),
 * rendering a standard 404 to prevent endpoint enumeration and leakage.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await apiServer<SelfUser>("/v1/me");

  if (!me || (me.role !== "admin" && me.role !== "moderator")) {
    notFound();
  }

  return <>{children}</>;
}
