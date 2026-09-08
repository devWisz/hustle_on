import type { Notification } from "./types";
import { formatSol } from "./format";

/**
 * Turns a notification row into something a person can read.
 *
 * The API stores an opaque `kind` plus a JSON payload, which keeps the backend
 * free to add kinds without a schema change. That freedom means the frontend
 * must handle a kind it has never seen, so every unknown kind still produces a
 * sentence rather than a blank row.
 */

export interface PresentedNotification {
  title: string;
  detail?: string;
  href?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Renders an unrecognised kind as a readable phrase: `job_closed` to `Job closed`. */
function humanise(kind: string): string {
  const words = kind.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Update";
}

export function presentNotification(
  notification: Notification,
): PresentedNotification {
  const payload = notification.payload ?? {};
  const handle = asString(payload.handle);
  const slug = asString(payload.slug);

  switch (notification.kind) {
    case "new_sponsor": {
      const amount = asNumber(payload.amount);
      return {
        title: "You were sponsored",
        detail: amount
          ? `${formatSol(amount)} settled on chain.`
          : "A sponsorship settled on chain.",
        href: slug ? `/watch/${slug}` : "/dashboard",
      };
    }
    case "payout": {
      const amount = asNumber(payload.amount);
      return {
        title: "A payout was released",
        detail: amount
          ? `${formatSol(amount)} is on its way to your wallet.`
          : undefined,
        href: "/dashboard",
      };
    }
    case "new_comment":
      return {
        title: "Someone commented on your session",
        detail: asString(payload.excerpt),
        href: slug ? `/watch/${slug}` : undefined,
      };
    case "comment_reply":
      return {
        title: "Someone replied to your comment",
        detail: asString(payload.excerpt),
        href: slug ? `/watch/${slug}` : undefined,
      };
    case "new_follower":
      return {
        title: "You have a new follower",
        detail: handle ? `@${handle} is following your sessions.` : undefined,
        href: handle ? `/creator/${handle}` : undefined,
      };
    case "application_update": {
      const status = asString(payload.status);
      return {
        title: "Your application changed status",
        detail: status ? `It is now ${status}.` : undefined,
        href: slug ? `/jobs/${slug}` : "/dashboard",
      };
    }
    case "engagement_update": {
      const status = asString(payload.status);
      return {
        title: "An engagement moved forward",
        detail: status ? `It is now ${status}.` : "A milestone was updated.",
        href: "/dashboard",
      };
    }
    case "moderation_notice":
      return {
        title: "A moderation decision affects your account",
        detail:
          asString(payload.reason) ?? "Open your dashboard for the details.",
        href: "/dashboard",
      };
    default:
      // The `kind` column is an enum today, so this is unreachable for current
      // data. It stays because adding a value to that enum must not be able to
      // render a blank row in this list.
      return { title: humanise(notification.kind) };
  }
}

/** Counts what the person has not read yet, for the header badge. */
export function unreadCount(items: Notification[]): number {
  return items.reduce((total, item) => (item.readAt ? total : total + 1), 0);
}
