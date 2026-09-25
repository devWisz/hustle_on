/**
 * The API's wire types.
 *
 * These mirror `backend/internal/domain`. When a field changes there it must
 * change here, which is the point: the compiler is what stops a page from
 * rendering a field the server stopped sending.
 */

export interface Creator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PublicUser extends Creator {
  bio?: string;
  /** Where donations to this creator are sent. Absent until they verify one. */
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

/** The lifecycle a submission moves through, in order. */
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
  /** Only present on the creator's own view and in the review queue. */
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
  /** Absent when the donation came from someone who was not signed in. */
  donor?: Creator;
  timelapseId?: string;
  confirmedAt?: string;
  createdAt: string;
}

/** What the client needs to build the transfer, fixed by the server. */
export interface DonationIntent {
  id: string;
  recipient: string;
  amountLamports: number;
  cluster: string;
}

/** A peer observation left against a published timelapse. */
export interface Note {
  id: string;
  body: string;
  /** Absent when the note is about the work as a whole. */
  timestampSeconds?: number;
  helpfulCount: number;
  /** Whether this browser's account has already marked the note helpful. */
  viewerHasVoted: boolean;
  /** Whether this browser's account may remove the note. */
  viewerCanDelete: boolean;
  author: Creator;
  createdAt: string;
}

/** One recorded operator action, as the review panel reads it. */
export interface AuditEntry {
  id: number;
  action: string;
  subjectType: string;
  subjectId?: string;
  /** Absent when the account that took the decision has since been deleted. */
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

export interface SessionResponse {
  authenticated: boolean;
  user?: SelfUser;
}
