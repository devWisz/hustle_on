import type { Timelapse } from "./types";

export interface ReviewFlag {
  label: string;
  tone: "warning" | "danger";
}

export function reviewFlags(t: Timelapse): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const words = t.summary.trim().split(/\s+/).length;
  if (words < 25) flags.push({ label: "Thin write-up", tone: "danger" });
  if (!t.githubUrl && !t.xUrl) flags.push({ label: "No links", tone: "warning" });
  if (t.sessionMinutes < 60) flags.push({ label: "Short session", tone: "warning" });
  if (t.title.trim().split(/\s+/).length < 3) flags.push({ label: "Vague title", tone: "warning" });
  return flags;
}

export function waitingMinutes(t: Timelapse): number {
  return (Date.now() - Date.parse(t.submittedAt ?? t.createdAt)) / 60000;
}

export function formatWait(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
