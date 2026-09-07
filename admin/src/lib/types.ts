export interface PlatformStats {
  users: number;
  publishedVideos: number;
  openReports: number;
  confirmedSponsorships: number;
  sponsorTotalLamports: number;
  openJobs: number;
}

export interface Reporter {
  id: string;
  handle: string;
  displayName: string;
}

export interface Report {
  id: string;
  subjectType: "video" | "comment" | "user" | "job";
  subjectId: string;
  reason: string;
  detail?: string;
  status: string;
  reportCount: number;
  reporter?: Reporter;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
}

/** The actions a moderator may take on a report. */
export const MODERATION_ACTIONS = [
  { value: "none", label: "Dismiss", adminOnly: false },
  { value: "content_hidden", label: "Hide content", adminOnly: false },
  { value: "content_removed", label: "Remove content", adminOnly: false },
  { value: "user_warned", label: "Warn user", adminOnly: false },
  { value: "user_suspended", label: "Suspend account", adminOnly: true },
  { value: "user_banned", label: "Ban account", adminOnly: true },
] as const;
