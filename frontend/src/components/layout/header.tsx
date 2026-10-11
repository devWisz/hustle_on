import Link from "next/link";
import { getViewer } from "@/lib/data";
import { LogoMark } from "../ui/icons";
import { HeaderClient } from "./header-client";

export async function Header() {
  const viewer = await getViewer();
  const user = viewer.user
    ? {
        handle: viewer.user.handle,
        displayName: viewer.user.displayName,
        avatarUrl: viewer.user.avatarUrl,
        role: viewer.user.role,
      }
    : undefined;
  return <HeaderClient user={user} />;
}

export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
        >
          <LogoMark />
          Hustle On
        </Link>
      </div>
    </header>
  );
}
