/** Shapes returned by the API. These mirror `backend/internal/domain`. */

export type SocialPlatform = "x" | "github" | "youtube" | "linkedin" | "website";

export interface SocialLink {
  platform: SocialPlatform;
  username: string;
  url: string;
  verified: boolean;
}

export interface Creator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  wallet?: string;
}

export interface PublicUser {
  id: string;
  handle: string;
  displayName: string;
  headline?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  skills: string[];
  openToWork: boolean;
  hourlyRateUsd?: number;
  followerCount: number;
  videoCount: number;
  sponsorTotalLamports: number;
  primaryWallet?: string;
  socialLinks: SocialLink[];
  joinedAt: string;
}

export interface SelfUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  role: "member" | "moderator" | "admin";
}

export interface Wallet {
  address: string;
  isPrimary: boolean;
  addedAt: string;
}

export interface Video {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: string;
  visibility: string;
  thumbnailUrl?: string;
  playbackUrl?: string;
  durationSeconds: number;
  sessionMinutes: number;
  tags: string[];
  viewCount: number;
  commentCount: number;
  sponsorCount: number;
  sponsorTotalLamports: number;
  creator: Creator;
  publishedAt?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  videoId: string;
  parentId?: string;
  body: string;
  likeCount: number;
  replyCount: number;
  author: Creator;
  editedAt?: string;
  createdAt: string;
  replies?: Comment[];
}

export interface Sponsorship {
  id: string;
  amount: number;
  mint?: string;
  message?: string;
  status: string;
  signature?: string;
  isAnonymous: boolean;
  sponsor?: Creator;
  videoId?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  skills: string[];
  engagement: "fixed" | "hourly" | "milestone";
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  isRemote: boolean;
  location?: string;
  status: string;
  applicationCount: number;
  client: Creator;
  publishedAt?: string;
  closesAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
  requestId?: string;
}
