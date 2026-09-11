package store

import (
	"strings"
	"testing"
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

// Only the default order may hand out a cursor. The ranked orders sort on a
// column that moves underneath the reader, and a keyset cursor over a moving
// value silently skips and repeats rows.
func TestOnlyRecentPages(t *testing.T) {
	if !(FeedQuery{Sort: FeedRecent}).pages() {
		t.Error("the default order must page")
	}
	for _, sort := range []FeedSort{FeedFunded, FeedWatched, FeedLongest} {
		if (FeedQuery{Sort: sort}).pages() {
			t.Errorf("ranked order %q must not page", sort)
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
