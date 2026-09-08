"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./toast";
import { Button } from "./ui";

/**
 * Marks every notification read.
 *
 * The list is rendered on the server, so a successful call refreshes the route
 * rather than editing local state — one source of truth for what is read.
 */
export function MarkAllRead() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function markRead() {
    setPending(true);
    try {
      await api("/v1/me/notifications/read", { method: "POST" });
      router.refresh();
    } catch {
      toast("Could not mark these as read. Try again in a moment.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={markRead} loading={pending}>
      Mark all read
    </Button>
  );
}
