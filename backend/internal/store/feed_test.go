package store

import (
	"strings"
	"testing"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

func TestParseFeedSort(t *testing.T) {
	cases := map[string]FeedSort{
		"":          FeedRecent,
		"funded":    FeedFunded,
		"FUNDED":    FeedFunded,
		"  watched": FeedWatched,
		"longest":   FeedLongest,
		// Anything unrecognised falls back rather than erroring, so a stale
		// bookmark still renders a feed.
		"trending":                 FeedRecent,
		"t.id; DROP TABLE users--": FeedRecent,
	}
	for in, want := range cases {
		if got := ParseFeedSort(in); got != want {
			t.Errorf("ParseFeedSort(%q) = %q, want %q", in, got, want)
		}
	}
}

// The ORDER BY is chosen from a fixed set by a switch. This pins that: every
// sort must resolve to one of the known clauses, so no input can reach the SQL.
func TestFeedOrderByIsClosedSet(t *testing.T) {
	allowed := map[string]bool{
		"t.published_at DESC, t.id DESC":                                 true,
		"t.donation_total_lamports DESC, t.published_at DESC, t.id DESC": true,
		"t.view_count DESC, t.published_at DESC, t.id DESC":              true,
		"t.session_minutes DESC, t.published_at DESC, t.id DESC":         true,
	}
	for _, in := range []string{"", "funded", "watched", "longest", "'; DROP TABLE users--"} {
		clause := FeedQuery{Sort: ParseFeedSort(in)}.orderBy()
		if !allowed[clause] {
			t.Errorf("sort %q produced an unexpected ORDER BY: %q", in, clause)
		}
	}
}

// Every order pages, and each mints the cursor shape it resumes from.
//
// The ranked orders used to refuse to page at all. That was defensible — their
// sort column moves underneath the reader — but it meant a tab that quietly
// stopped at the first page with no sign there was more. Now they page, and the
// cursor carries the ranking value as well as the timestamp, because plenty of
// sessions tie on a donation total and a timestamp alone could not say which of
// them had been seen.
func TestEveryOrderMintsACursorItCanResumeFrom(t *testing.T) {
	published := time.Date(2026, 2, 3, 4, 5, 6, 0, time.UTC)
	row := domain.Timelapse{
		ID:             "11111111-1111-1111-1111-111111111111",
		PublishedAt:    &published,
		DonationTotal:  4200,
		ViewCount:      17,
		SessionMinutes: 90,
	}

	recent := FeedQuery{Sort: FeedRecent}.cursorFor(row)
	if recent == "" {
		t.Fatal("the default order produced no cursor")
	}
	if at, id, err := decodeTimeIDCursor(recent); err != nil || at == nil || *id != row.ID {
		t.Fatalf("the default cursor did not round trip: at=%v id=%v err=%v", at, id, err)
	}
	// A two-field cursor is not a ranked cursor. Handing one to a ranked order
	// must be refused outright rather than quietly read as page one.
	if _, _, _, err := decodeIntTimeIDCursor(recent); err == nil {
		t.Error("a default-order cursor was accepted by a ranked order")
	}

	for _, tc := range []struct {
		sort FeedSort
		want int64
	}{
		{FeedFunded, 4200},
		{FeedWatched, 17},
		{FeedLongest, 90},
	} {
		cursor := FeedQuery{Sort: tc.sort}.cursorFor(row)
		if cursor == "" {
			t.Fatalf("%s produced no cursor", tc.sort)
		}
		rank, at, id, err := decodeIntTimeIDCursor(cursor)
		if err != nil || rank == nil || *rank != tc.want || at == nil || *id != row.ID {
			t.Errorf("%s cursor round-tripped to rank=%v at=%v id=%v err=%v, want rank %d",
				tc.sort, rank, at, id, err, tc.want)
		}
	}
}

// A row with no publication timestamp ends paging rather than looping, on every
// order — there is no position to resume from.
func TestARowWithNoTimestampEndsPaging(t *testing.T) {
	row := domain.Timelapse{ID: "11111111-1111-1111-1111-111111111111"}
	for _, sort := range []FeedSort{FeedRecent, FeedFunded, FeedWatched, FeedLongest} {
		if got := (FeedQuery{Sort: sort}).cursorFor(row); got != "" {
			t.Errorf("%s minted a cursor for a row with no published_at: %q", sort, got)
		}
	}
}

func TestLikePattern(t *testing.T) {
	if got := likePattern("   "); got != nil {
		t.Errorf("a blank term must not filter, got %q", *got)
	}

	got := likePattern("go auth")
	if got == nil || *got != "%go auth%" {
		t.Fatalf("likePattern(\"go auth\") = %v, want %%go auth%%", got)
	}

	// A wildcard a visitor types is a literal character to search for, not an
	// instruction: a lone "%" must find nothing rather than scan every row.
	for term, want := range map[string]string{
		"100%":       `%100\%%`,
		"my_file":    `%my\_file%`,
		`back\slash`: `%back\\slash%`,
	} {
		got := likePattern(term)
		if got == nil || *got != want {
			t.Errorf("likePattern(%q) = %v, want %q", term, got, want)
		}
	}

	// The pattern length is what the match costs, so the term is capped.
	long := likePattern(strings.Repeat("a", 500))
	if long == nil || len(*long) != 82 {
		t.Errorf("an over-long term must be capped to 80 characters plus wildcards, got %d", len(*long))
	}
}
