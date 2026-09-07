// Package domain holds the entities the API exposes. These structs are the
// wire contract: JSON tags here are what clients see, so a field added to the
// database is invisible until it is added here deliberately.
package domain

import "time"

// PublicUser is the profile shape returned for any visitor.
// Email and role are absent by design; they are not public information.
type PublicUser struct {
	ID          string   `json:"id"`
	Handle      string   `json:"handle"`
	DisplayName string   `json:"displayName"`
	Headline    string   `json:"headline,omitempty"`
	Bio         string   `json:"bio,omitempty"`
	Location    string   `json:"location,omitempty"`
	AvatarURL   string   `json:"avatarUrl,omitempty"`
	BannerURL   string   `json:"bannerUrl,omitempty"`
	Skills      []string `json:"skills"`
	OpenToWork  bool     `json:"openToWork"`
	HourlyRate  *float64 `json:"hourlyRateUsd,omitempty"`

	FollowerCount int          `json:"followerCount"`
	VideoCount    int          `json:"videoCount"`
	SponsorTotal  int64        `json:"sponsorTotalLamports"`
	PrimaryWallet string       `json:"primaryWallet,omitempty"`
	SocialLinks   []SocialLink `json:"socialLinks"`
	JoinedAt      time.Time    `json:"joinedAt"`
}

// SelfUser adds the fields a signed-in user may see about themselves.
type SelfUser struct {
	PublicUser
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
	Role          string `json:"role"`
}

type SocialLink struct {
	Platform string `json:"platform"`
	Username string `json:"username"`
	URL      string `json:"url"`
	Verified bool   `json:"verified"`
}

type Wallet struct {
	Address   string    `json:"address"`
	IsPrimary bool      `json:"isPrimary"`
	AddedAt   time.Time `json:"addedAt"`
}

// Video is a published timelapse.
type Video struct {
	ID             string     `json:"id"`
	Slug           string     `json:"slug"`
	Title          string     `json:"title"`
	Description    string     `json:"description,omitempty"`
	Status         string     `json:"status"`
	Visibility     string     `json:"visibility"`
	ThumbnailURL   string     `json:"thumbnailUrl,omitempty"`
	PlaybackURL    string     `json:"playbackUrl,omitempty"`
	DurationSecs   int        `json:"durationSeconds"`
	SessionMinutes int        `json:"sessionMinutes"`
	Tags           []string   `json:"tags"`
	ViewCount      int        `json:"viewCount"`
	CommentCount   int        `json:"commentCount"`
	SponsorCount   int        `json:"sponsorCount"`
	SponsorTotal   int64      `json:"sponsorTotalLamports"`
	Creator        Creator    `json:"creator"`
	PublishedAt    *time.Time `json:"publishedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

// Creator is the compact author reference embedded in lists.
type Creator struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	Wallet      string `json:"wallet,omitempty"`
}

type Comment struct {
	ID         string     `json:"id"`
	VideoID    string     `json:"videoId"`
	ParentID   string     `json:"parentId,omitempty"`
	Body       string     `json:"body"`
	LikeCount  int        `json:"likeCount"`
	ReplyCount int        `json:"replyCount"`
	Author     Creator    `json:"author"`
	EditedAt   *time.Time `json:"editedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	Replies    []Comment  `json:"replies,omitempty"`
}

type Sponsorship struct {
	ID          string    `json:"id"`
	Amount      int64     `json:"amount"`
	Mint        string    `json:"mint,omitempty"`
	Message     string    `json:"message,omitempty"`
	Status      string    `json:"status"`
	Signature   string    `json:"signature,omitempty"`
	IsAnonymous bool      `json:"isAnonymous"`
	Sponsor     *Creator  `json:"sponsor,omitempty"`
	VideoID     string    `json:"videoId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Job struct {
	ID           string     `json:"id"`
	Slug         string     `json:"slug"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Skills       []string   `json:"skills"`
	Engagement   string     `json:"engagement"`
	BudgetMin    *float64   `json:"budgetMinUsd,omitempty"`
	BudgetMax    *float64   `json:"budgetMaxUsd,omitempty"`
	IsRemote     bool       `json:"isRemote"`
	Location     string     `json:"location,omitempty"`
	Status       string     `json:"status"`
	Applications int        `json:"applicationCount"`
	Client       Creator    `json:"client"`
	PublishedAt  *time.Time `json:"publishedAt,omitempty"`
	ClosesAt     *time.Time `json:"closesAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type Application struct {
	ID           string    `json:"id"`
	JobID        string    `json:"jobId"`
	CoverNote    string    `json:"coverNote,omitempty"`
	PortfolioIDs []string  `json:"portfolioVideoIds"`
	RateUSD      *float64  `json:"rateUsd,omitempty"`
	Status       string    `json:"status"`
	Applicant    Creator   `json:"applicant"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Notification struct {
	ID        string         `json:"id"`
	Kind      string         `json:"kind"`
	Payload   map[string]any `json:"payload"`
	ReadAt    *time.Time     `json:"readAt,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

// Page is the envelope for every list endpoint. Cursors are opaque to clients.
type Page[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor,omitempty"`
}

// Report is a moderation report as the admin console sees it.
type Report struct {
	ID          string    `json:"id"`
	SubjectType string    `json:"subjectType"`
	SubjectID   string    `json:"subjectId"`
	Reason      string    `json:"reason"`
	Detail      string    `json:"detail,omitempty"`
	Status      string    `json:"status"`
	ReportCount int       `json:"reportCount"`
	Reporter    *Creator  `json:"reporter,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}
