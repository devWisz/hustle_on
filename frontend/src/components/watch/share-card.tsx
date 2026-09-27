"use client";

import { useState } from "react";
import type { Timelapse } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Card } from "../ui";
import { CheckIcon, CopyIcon } from "../ui/icons";

export function ShareCard({ timelapse, siteUrl }: { timelapse: Timelapse; siteUrl: string }) {
  const { success } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const watchUrl = `${siteUrl}/watch/${timelapse.slug}`;
  const markdown = timelapse.thumbnailUrl
    ? `[![${timelapse.title}](${timelapse.thumbnailUrl})](${watchUrl})`
    : `[${timelapse.title}](${watchUrl})`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      success(`Copied the ${label}`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold">Share and embed</h2>
      <p className="mt-1 text-[13px] text-fg-muted">Put it in a README, a portfolio or a pitch.</p>
      <div className="mt-4 space-y-3">
        {[
          { label: "link", value: watchUrl, rows: 1 },
          { label: "Markdown badge", value: markdown, rows: 4 },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium capitalize text-fg-subtle">{s.label}</span>
              <button
                type="button"
                onClick={() => copy(s.value, s.label)}
                className="press inline-flex items-center gap-1 text-[12px] font-medium text-accent"
              >
                {copied === s.label ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                {copied === s.label ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              wrap={s.rows === 1 ? "off" : "soft"}
              rows={s.rows}
              value={s.value}
              aria-label={`${s.label} to copy`}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1.5 w-full resize-none rounded-[var(--radius-control)] border border-border bg-surface-raised px-3 py-2 font-mono text-[11.5px] text-fg-muted outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
