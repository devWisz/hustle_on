"use client";

import { useState } from "react";
import { useToast } from "./toast";
import { CheckIcon, LinkIcon } from "./icons";
import { buttonClass } from "./ui";

/**
 * Shares the current page.
 *
 * Where the platform offers a share sheet we hand off to it, because that is
 * the route to the apps people actually send links through. Everywhere else it
 * copies to the clipboard. The URL is resolved at click time rather than at
 * render so the component works unchanged on any route, and so a server render
 * never has to know the origin.
 */
export function ShareButton({
  title,
  text,
  path,
  label = "Share",
  className,
}: {
  title: string;
  text?: string;
  /** Defaults to the current location. */
  path?: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;

    // `navigator.share` rejects with AbortError when someone dismisses the
    // sheet. That is not a failure and must not surface as one.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Any other failure falls through to the clipboard path below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Link copied to your clipboard.");
    } catch {
      toast("Could not copy the link. Copy it from the address bar instead.", "error");
    }
  }

  return (
    <button type="button" onClick={share} className={buttonClass("secondary", "sm", className)}>
      {copied ? <CheckIcon size={15} /> : <LinkIcon size={15} />}
      {copied ? "Copied" : label}
    </button>
  );
}
