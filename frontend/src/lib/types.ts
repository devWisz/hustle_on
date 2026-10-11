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
  /** The Solana address that signs in for this account. */
  walletAddress?: string;
  /** A contact address held on the account. Not a credential. */
  email?: string;
  role: "member" | "admin";
  payoutVerified: boolean;
  /** False until the account holder has chosen their own handle and name. */
  onboarded: boolean;
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
  featured?: boolean;
  /**
   * Position on the curated front page, 1-based; absent when the session is not
   * on it. Only the admin console receives this — the API clears it from every
   * public payload, so a visitor cannot read the shelf's arrangement.
   */
  featuredRank?: number;
  reviewNote?: string;
  submittedAt?: string;
  publishedAt?: string;
  createdAt: string;
}

/** What the API reports about the cluster it verifies donations against. */
export interface ChainStatus {
  cluster: string;
  reachable: boolean;
  detail: string;
  checkedAt: string;
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
  /** The sponsorship program to call. Absent means send a plain transfer. */
  programId?: string;
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
  /** The account's identity; `email` is a contact address held on it. */
  walletAddress?: string;
  email?: string;
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

export type ReportReason =
  "spam" | "not_their_work" | "misleading" | "inappropriate" | "harassment" | "other";

export interface Report {
  id: string;
  subjectType: "timelapse" | "note";
  reason: ReportReason;
  details?: string;
  status: "open" | "resolved" | "dismissed";
  reporter?: Creator;
  timelapse: { id: string; slug: string; title: string; status: TimelapseStatus; creator: Creator };
  note?: { id: string; body: string; author: Creator };
  resolvedAt?: string;
  createdAt: string;
}
