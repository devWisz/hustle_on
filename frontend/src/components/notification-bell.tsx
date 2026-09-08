"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Notification, Page } from "@/lib/types";
import { presentNotification, unreadCount } from "@/lib/notifications";
import { timeAgo } from "@/lib/format";
import { BellIcon } from "./icons";

/**
 * The header bell.
 *
 * The list arrives from the server render, so the unread badge is correct
 * before any client request is made. Opening the panel refreshes it and marks
 * everything read, which is what opening it means.
 */
export function NotificationBell({
  initialItems,
}: {
  initialItems: Notification[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(initialItems);
  const [unread, setUnread] = useState(() => unreadCount(initialItems));
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api<Page<Notification>>(
        "/v1/me/notifications?limit=8",
      );
      setItems(page.items);
      setUnread(unreadCount(page.items));
      if (unreadCount(page.items) > 0) {
        // Best effort: failing to record the read does not change what is shown.
        api("/v1/me/notifications/read", { method: "POST" })
          .then(() => setUnread(0))
          .catch(() => {});
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems(initialItems);
    setUnread(unreadCount(initialItems));
  }, [initialItems]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Dismiss on Escape or a click outside, the two gestures people expect from
  // a popover attached to a header control.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)]
                   text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon size={17} />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center
                       rounded-full border border-bg bg-accent px-1 text-[9px] font-semibold
                       leading-none tabular-nums text-accent-fg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-[var(--radius-card)]
                     border border-border bg-surface shadow-[var(--shadow-raised)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-[13px] font-semibold">Notifications</h2>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[12px] text-fg-muted transition-colors hover:text-fg"
            >
              See all
            </Link>
          </div>

          {loading && items === null ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-muted">
              Loading.
            </p>
          ) : items && items.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const view = presentNotification(item);
                const body = (
                  <>
                    <p className="text-[13px] font-medium">{view.title}</p>
                    {view.detail ? (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
                        {view.detail}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-fg-subtle">
                      {timeAgo(item.createdAt)}
                    </p>
                  </>
                );
                return (
                  <li
                    key={item.id}
                    className="border-b border-border last:border-0"
                  >
                    {view.href ? (
                      <Link
                        href={view.href}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-surface-raised"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-[13px] leading-relaxed text-fg-muted">
              Nothing yet. Sponsorships and application updates land here.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
