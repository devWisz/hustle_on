"use client";

import { useState } from "react";
import { useToast } from "../layout/toast";
import { CheckIcon, LinkIcon } from "../ui/icons";
import { buttonClass } from "../ui/button";

export function ShareButton({
  title,
  text,
  path,
  label = "Share",
  className,
}: {
  title: string;
  text?: string;

  path?: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;

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
