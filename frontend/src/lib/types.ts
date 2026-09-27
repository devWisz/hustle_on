export interface Creator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PublicUser extends Creator {
  bio?: string;

  payoutAddress?: string;
  timelapseCount: number;
  donationCount: number;
  donationTotalLamports: number;
  joinedAt: string;
}

export interface SelfUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  role: "member" | "admin";
  payoutVerified: boolean;
}

export type TimelapseStatus =
  "draft" | "uploaded" | "in_review" | "published" | "rejected" | "removed";

export interface Timelapse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  githubUrl?: string;
  xUrl?: string;
  status: TimelapseStatus;
  thumbnailUrl?: string;
  playbackUrl?: string;
  durationSeconds: number;
  sessionMinutes: number;
  viewCount: number;
  donationCount: number;
  donationTotalLamports: number;
  creator: Creator;

  reviewNote?: string;
  submittedAt?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface Donation {
  id: string;
  amountLamports: number;
  message?: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  signature?: string;

  donor?: Creator;
  timelapseId?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface DonationIntent {
  id: string;
  recipient: string;
  amountLamports: number;
  cluster: string;
}

export interface Note {
  id: string;
  body: string;

  timestampSeconds?: number;
  helpfulCount: number;

  viewerHasVoted: boolean;

  viewerCanDelete: boolean;
  author: Creator;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  subjectType: string;
  subjectId?: string;

  actor?: Creator;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Stats {
  creators: number;
  publishedTimelapses: number;
  sessionMinutesRecorded: number;
  confirmedDonations: number;
  donationTotalLamports: number;
}

export interface Upload {
  url: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
  requestId?: string;
}

export type AdminAccess = "ok" | "reauth_required" | "network_blocked";

export interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
  adminAccess?: AdminAccess;
}

export interface AdminNote {
  id: string;
  body: string;
  timestampSeconds?: number;
  helpfulCount: number;
  author: Creator;
  timelapse: { slug: string; title: string };
  createdAt: string;
}

export interface AdminMember extends PublicUser {
  email: string;
  role: "member" | "admin";
  status: "active" | "suspended";
  payoutVerified: boolean;
  inReview: number;
  rejected: number;
  lastActiveAt: string;
}

export interface LedgerEntry extends Donation {
  timelapse: { slug: string; title: string };
  recipient: Creator;
}

export interface ActivityDay {
  date: string;
  submitted: number;
  approved: number;
  rejected: number;
  lamports: number;
}
