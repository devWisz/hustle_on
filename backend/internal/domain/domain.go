// Package domain holds the entities the API exposes.
//
// These structs are the wire contract. JSON tags here are what clients see, so
// a column added to the database stays invisible until it is added to a struct
// in this file deliberately — which is how email addresses and review notes
// stay off public payloads.
package domain

import "time"

// Creator is the compact author reference embedded in lists and cards.
type Creator struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
}

// PublicUser is the profile shape returned to any visitor. Email, role and
// review history are absent by design; none of them are public information.
type PublicUser struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	Bio         string `json:"bio,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`

	// The address donations to this creator are sent to. Public because a donor
	// needs it to build the transaction.
	PayoutAddress string `json:"payoutAddress,omitempty"`

	TimelapseCount int       `json:"timelapseCount"`
	DonationCount  int       `json:"donationCount"`
	DonationTotal  int64     `json:"donationTotalLamports"`
	JoinedAt       time.Time `json:"joinedAt"`
}

// SelfUser adds the fields an account may see about itself.
type SelfUser struct {
	PublicUser
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
	Role          string `json:"role"`
	// True once the payout address has been proven by a signature.
	PayoutVerified bool `json:"payoutVerified"`
}

// Timelapse is one published — or pending — work session.
type Timelapse struct {
	ID      string `json:"id"`
	Slug    string `json:"slug"`
	Title   string `json:"title"`
	Summary string `json:"summary"`

	GitHubURL string `json:"githubUrl,omitempty"`
	XURL      string `json:"xUrl,omitempty"`

	Status         string `json:"status"`
	ThumbnailURL   string `json:"thumbnailUrl,omitempty"`
	PlaybackURL    string `json:"playbackUrl,omitempty"`
	DurationSecs   int    `json:"durationSeconds"`
	SessionMinutes int    `json:"sessionMinutes"`

	ViewCount     int   `json:"viewCount"`
	DonationCount int   `json:"donationCount"`
	DonationTotal int64 `json:"donationTotalLamports"`

	Creator Creator `json:"creator"`

	// ReviewNote is only ever populated for the creator's own view of their
	// submission and for an admin. It is empty on every public payload.
	ReviewNote  string     `json:"reviewNote,omitempty"`
	SubmittedAt *time.Time `json:"submittedAt,omitempty"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// Donation is a supporter's contribution as the public sees it.
type Donation struct {
	ID      string `json:"id"`
	Amount  int64  `json:"amountLamports"`
	Message string `json:"message,omitempty"`
	Status  string `json:"status"`
	// Present once the transaction has been verified, so a viewer can check it
	// on an explorer themselves.
	Signature string `json:"signature,omitempty"`
	// Nil for a donation sent by someone who was not signed in.
	Donor       *Creator   `json:"donor,omitempty"`
	TimelapseID string     `json:"timelapseId,omitempty"`
	ConfirmedAt *time.Time `json:"confirmedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// DonationIntent is what the client needs to build and send the transaction.
type DonationIntent struct {
	ID        string `json:"id"`
	Recipient string `json:"recipient"`
	Amount    int64  `json:"amountLamports"`
	Cluster   string `json:"cluster"`
}

// Note is a peer observation left against a published timelapse.
//
// The author is embedded rather than referenced by id, because the thread is
// public: a reader deciding whether an observation holds up needs to see who
// made it, and a second round trip per note to resolve a name is a cost the
// list endpoint should not impose.
type Note struct {
	ID   string `json:"id"`
	Body string `json:"body"`

	// Absent means the note is about the work as a whole. Zero is a real
	// timestamp, which is why this is a pointer rather than a plain int.
	TimestampSeconds *int `json:"timestampSeconds,omitempty"`

	HelpfulCount int `json:"helpfulCount"`
	// Whether the caller has already marked this note helpful. Always false for
	// a signed-out reader, who has no identity to record a vote against.
	ViewerHasVoted bool `json:"viewerHasVoted"`
	// Whether the caller may remove this note. Decided by the server rather than
	// inferred by the client from a user id, so the rule for who may moderate
	// lives in exactly one place.
	ViewerCanDelete bool `json:"viewerCanDelete"`

	Author    Creator   `json:"author"`
	CreatedAt time.Time `json:"createdAt"`
}

// AuditEntry is one recorded operator action, as the review panel reads it.
//
// Actor is nullable because an account can be deleted without erasing the
// decisions it took: the entry survives, attributed to nobody, which is the
// honest record.
type AuditEntry struct {
	ID          int64          `json:"id"`
	Action      string         `json:"action"`
	SubjectType string         `json:"subjectType"`
	SubjectID   string         `json:"subjectId,omitempty"`
	Actor       *Creator       `json:"actor,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
}

// Stats is the anonymous homepage snapshot. Queue depth stays off it, so the
// public site cannot be used to measure how far behind review is.
type Stats struct {
	Creators       int   `json:"creators"`
	Published      int   `json:"publishedTimelapses"`
	SessionMinutes int64 `json:"sessionMinutesRecorded"`
	DonationCount  int   `json:"confirmedDonations"`
	DonationTotal  int64 `json:"donationTotalLamports"`
}

// Page is the envelope every list endpoint returns. Cursors are opaque.
type Page[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor,omitempty"`
}

// AdminMember is an account as the admin console lists it.
type AdminMember struct {
	PublicUser
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	PayoutVerified bool      `json:"payoutVerified"`
	InReview       int       `json:"inReview"`
	Rejected       int       `json:"rejected"`
	LastActiveAt   time.Time `json:"lastActiveAt"`
}

// LedgerSession names the session a sponsorship was sent to.
type LedgerSession struct {
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

// LedgerEntry is one sponsorship with the people and session around it.
type LedgerEntry struct {
	Donation
	Timelapse LedgerSession `json:"timelapse"`
	Recipient Creator       `json:"recipient"`
}

// ActivityDay is one day of review and sponsorship activity.
type ActivityDay struct {
	Date      time.Time `json:"date"`
	Submitted int       `json:"submitted"`
	Approved  int       `json:"approved"`
	Rejected  int       `json:"rejected"`
	Lamports  int64     `json:"lamports"`
}

// AdminNote is a note as the moderation list shows it, with its session.
type AdminNote struct {
	ID               string        `json:"id"`
	Body             string        `json:"body"`
	TimestampSeconds *int          `json:"timestampSeconds,omitempty"`
	HelpfulCount     int           `json:"helpfulCount"`
	Author           Creator       `json:"author"`
	Timelapse        LedgerSession `json:"timelapse"`
	CreatedAt        time.Time     `json:"createdAt"`
}
