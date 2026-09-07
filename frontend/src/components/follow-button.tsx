"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui";

/** Follow toggle. Optimistic, and it reverts if the request fails. */
export function FollowButton({
  handle,
  signedIn,
  isSelf,
  initiallyFollowing = false,
}: {
  handle: string;
  signedIn: boolean;
  isSelf?: boolean;
  initiallyFollowing?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  if (isSelf) return null;

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=/creator/${handle}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await api(`/v1/creators/${handle}/follow`, { method: next ? "POST" : "DELETE" });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      onClick={toggle}
      loading={busy}
      aria-pressed={following}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
