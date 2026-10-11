import Link from "next/link";
import { SignInFromGuest } from "./guest-actions";
import { Card } from "../ui";
import { LockIcon } from "../ui/icons";

/**
 * What a guest sees where an account is needed.
 *
 * A redirect to the sign-in page answers "no" without saying why, and a guest
 * has already told us they want to look around rather than sign up. This says
 * what the account is for, keeps the invitation one click away, and leaves the
 * browsing they were doing one link away too.
 */
export function GuestNotice({
  what,
  next,
  reason,
}: {
  /** The thing they tried to reach, named the way a person would say it. */
  what: string;
  next: string;
  reason: string;
}) {
  return (
    <Card as="section" className="mt-6 p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-fg-muted">
          <LockIcon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">{what} needs an account</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-muted">{reason}</p>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-muted">
            You can keep browsing as a guest — every published session is open to anyone.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SignInFromGuest next={next} />
            <Link
              href="/"
              className="text-[13.5px] text-fg-muted underline underline-offset-2 hover:text-fg"
            >
              Keep browsing
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
