"use client";

import { useState } from "react";
import type { Timelapse } from "@/lib/types";
import { formatDuration, formatSession } from "@/lib/format";
import { Card } from "./ui";
import { useToast } from "./toast";
import {
  CodeIcon,
  CopyIcon,
  ExternalIcon,
  GitHubIcon,
  XIcon,
  ZapIcon,
} from "./icons";

interface SessionInspectorProps {
  timelapse: Timelapse;
  siteUrl?: string;
}

export function SessionInspector({
  timelapse,
  siteUrl = "http://localhost:3001",
}: SessionInspectorProps) {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "embed">("overview");

  const duration = timelapse.durationSeconds || 1;
  const compressionRatio =
    timelapse.sessionMinutes > 0
      ? Math.round((timelapse.sessionMinutes * 60) / duration)
      : 1;

  const watchUrl = `${siteUrl}/watch/${timelapse.slug}`;
  const markdownSnippet = `[![Timelapse: ${timelapse.title}](${siteUrl}/og/${timelapse.slug})](${watchUrl})`;
  const iframeSnippet = `<iframe src="${watchUrl}" width="640" height="360" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    success(`Copied ${label} to clipboard`);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <ZapIcon size={15} className="text-accent" />
          <span>Session Intelligence</span>
        </h3>

        <div className="flex rounded-md border border-border bg-surface p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`rounded px-2 py-0.5 transition-colors ${
              activeTab === "overview"
                ? "bg-surface-raised font-semibold text-fg"
                : "text-fg-subtle hover:text-fg"
            }`}
          >
            Stats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("embed")}
            className={`rounded px-2 py-0.5 transition-colors ${
              activeTab === "embed"
                ? "bg-surface-raised font-semibold text-fg"
                : "text-fg-subtle hover:text-fg"
            }`}
          >
            Embed
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/70 bg-surface-raised/40 p-3">
              <span className="text-[11px] font-medium text-fg-subtle">Real Work Session</span>
              <p className="mt-1 font-mono text-[16px] font-semibold text-fg">
                {timelapse.sessionMinutes > 0 ? formatSession(timelapse.sessionMinutes) : "N/A"}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-surface-raised/40 p-3">
              <span className="text-[11px] font-medium text-fg-subtle">Playback Duration</span>
              <p className="mt-1 font-mono text-[16px] font-semibold text-fg">
                {formatDuration(timelapse.durationSeconds)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-fg-muted">Time Compression</span>
              <span className="font-mono text-[13px] font-bold text-accent">
                {compressionRatio}x speedup
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
              {timelapse.sessionMinutes > 0
                ? `1 second of video represents approx. ${(timelapse.sessionMinutes * 60 / duration).toFixed(0)} seconds of hands-on engineering.`
                : "Session length not entered."}
            </p>
          </div>

          {(timelapse.githubUrl || timelapse.xUrl) && (
            <div className="pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Verified Links
              </span>
              <div className="mt-2 flex flex-col gap-1.5">
                {timelapse.githubUrl && (
                  <a
                    href={timelapse.githubUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="press flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <GitHubIcon size={14} />
                      <span className="truncate max-w-[220px]">
                        {timelapse.githubUrl.replace("https://github.com/", "")}
                      </span>
                    </span>
                    <ExternalIcon size={13} className="shrink-0 text-fg-subtle" />
                  </a>
                )}

                {timelapse.xUrl && (
                  <a
                    href={timelapse.xUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="press flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <XIcon size={13} />
                      <span className="truncate max-w-[220px]">
                        {timelapse.xUrl.replace("https://x.com/", "@").replace("https://twitter.com/", "@")}
                      </span>
                    </span>
                    <ExternalIcon size={13} className="shrink-0 text-fg-subtle" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-fg-subtle">
              <span>GitHub README Markdown</span>
              <button
                type="button"
                onClick={() => copyToClipboard(markdownSnippet, "Markdown snippet")}
                className="press flex items-center gap-1 text-accent hover:underline"
              >
                <CopyIcon size={11} />
                <span>Copy</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={2}
              value={markdownSnippet}
              className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-fg-muted outline-none focus:border-border-strong"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-fg-subtle">
              <span>HTML &lt;iframe&gt; Embed</span>
              <button
                type="button"
                onClick={() => copyToClipboard(iframeSnippet, "Embed code")}
                className="press flex items-center gap-1 text-accent hover:underline"
              >
                <CodeIcon size={12} />
                <span>Copy</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={3}
              value={iframeSnippet}
              className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-fg-muted outline-none focus:border-border-strong"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
