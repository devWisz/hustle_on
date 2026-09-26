"use client";

import { useState } from "react";
import type { Timelapse } from "@/lib/types";
import { formatDuration, formatSession } from "@/lib/format";
import { Card } from "../ui";
import { useToast } from "../layout/toast";
import {
  CopyIcon,
  ExternalIcon,
  GitHubIcon,
  LinkIcon,
  XIcon,
  ZapIcon,
} from "../ui/icons";

interface SessionInspectorProps {
  timelapse: Timelapse;

  siteUrl: string;
}

export function SessionInspector({ timelapse, siteUrl }: SessionInspectorProps) {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "share">("overview");

  const duration = timelapse.durationSeconds || 1;
  const compressionRatio =
    timelapse.sessionMinutes > 0
      ? Math.round((timelapse.sessionMinutes * 60) / duration)
      : 1;
  const secondsPerVideoSecond = timelapse.sessionMinutes > 0
    ? (timelapse.sessionMinutes * 60) / duration
    : 0;

  const watchUrl = `${siteUrl}/watch/${timelapse.slug}`;

  const markdownSnippet = timelapse.thumbnailUrl
    ? `[![Timelapse: ${timelapse.title}](${timelapse.thumbnailUrl})](${watchUrl})`
    : `[${timelapse.title}](${watchUrl})`;

  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      success(`Copied ${label}`);

      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <ZapIcon size={15} className="text-accent" />
          <span>Session details</span>
        </h2>

        <div className="flex rounded-[var(--radius-control)] border border-border bg-surface p-0.5 text-[11px] font-medium">
          {(["overview", "share"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`press rounded-[calc(var(--radius-control)-2px)] px-2 py-0.5 capitalize transition-colors duration-200 ${
                activeTab === tab
                  ? "bg-surface-raised font-semibold text-fg"
                  : "text-fg-subtle hover:text-fg"
              }`}
            >
              {tab === "share" ? "Share" : "Stats"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-control)] border border-border/70 bg-surface-raised/40 p-3">
              <span className="text-[11px] font-medium text-fg-subtle">Real work session</span>
              <p className="mt-1 font-mono text-[16px] font-semibold tabular-nums text-fg">
                {timelapse.sessionMinutes > 0 ? formatSession(timelapse.sessionMinutes) : "—"}
              </p>
            </div>

            <div className="rounded-[var(--radius-control)] border border-border/70 bg-surface-raised/40 p-3">
              <span className="text-[11px] font-medium text-fg-subtle">Playback</span>
              <p className="mt-1 font-mono text-[16px] font-semibold tabular-nums text-fg">
                {formatDuration(timelapse.durationSeconds)}
              </p>
            </div>
          </div>

          {secondsPerVideoSecond > 0 ? (
            <div className="rounded-[var(--radius-control)] border border-accent/20 bg-accent-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-fg-muted">Time compression</span>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-accent">
                  {compressionRatio}× speedup
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                One second of video stands for about{" "}
                {Math.round(secondsPerVideoSecond)} seconds of hands-on work.
              </p>
            </div>
          ) : null}

          {timelapse.githubUrl || timelapse.xUrl ? (
            <div className="pt-1">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Where this work lives
              </h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {timelapse.githubUrl ? (
                  <SourceRow
                    href={timelapse.githubUrl}
                    icon={<GitHubIcon size={14} />}
                    label={timelapse.githubUrl.replace("https://github.com/", "")}
                  />
                ) : null}
                {timelapse.xUrl ? (
                  <SourceRow
                    href={timelapse.xUrl}
                    icon={<XIcon size={13} />}
                    label={timelapse.xUrl
                      .replace("https://x.com/", "@")
                      .replace("https://twitter.com/", "@")}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Snippet
            label="Link"
            value={watchUrl}
            rows={1}
            copied={copied === "link"}
            onCopy={() => copy(watchUrl, "link")}
          />
          <Snippet
            label="Markdown"
            value={markdownSnippet}
            rows={3}
            copied={copied === "Markdown snippet"}
            onCopy={() => copy(markdownSnippet, "Markdown snippet")}
          />
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-fg-subtle">
            <LinkIcon size={12} className="mt-px shrink-0" />
            <span>
              Paste the Markdown into a README to make the title link back here.
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}

function SourceRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className="press flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-[12px] font-medium text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <ExternalIcon size={13} className="shrink-0 text-fg-subtle" />
    </a>
  );
}

function Snippet({
  label,
  value,
  rows,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  rows: number;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-fg-subtle">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="press flex items-center gap-1 rounded text-[11px] font-medium text-accent transition-colors hover:underline"
        >
          <CopyIcon size={11} />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <textarea
        readOnly
        rows={rows}
        value={value}
        aria-label={`${label} to copy`}

        onFocus={(e) => e.currentTarget.select()}
        className="mt-1.5 w-full resize-none rounded-[var(--radius-control)] border border-border bg-surface-raised px-2.5 py-1.5 font-mono text-[11px] text-fg-muted outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}
