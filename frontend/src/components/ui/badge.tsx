import type { TimelapseStatus } from "@/lib/types";
import { Badge } from "./ui";

/**
 * The review state of a submission, in the creator's own words rather than the
 * database's. "in_review" is a column value; "Waiting for review" is what the
 * person who uploaded it needs to know.
 */
const LABELS: Record<TimelapseStatus, { text: string; tone: "neutral" | "accent" | "danger" }> = {
  draft: { text: "Draft", tone: "neutral" },
  uploaded: { text: "Not submitted", tone: "neutral" },
  in_review: { text: "Waiting for review", tone: "neutral" },
  published: { text: "Published", tone: "accent" },
  rejected: { text: "Needs changes", tone: "danger" },
  removed: { text: "Removed", tone: "neutral" },
};

export function StatusBadge({ status }: { status: TimelapseStatus }) {
  const label = LABELS[status] ?? LABELS.draft;
  return <Badge tone={label.tone}>{label.text}</Badge>;
}
