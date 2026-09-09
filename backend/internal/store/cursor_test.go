package store

import (
	"testing"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

func TestCursorRoundTrip(t *testing.T) {
	// Microsecond truncation matches what Postgres stores, so the value that
	// comes back out of a timestamptz column round trips exactly.
	at := time.Now().UTC().Truncate(time.Microsecond)
	id := "0c2ea1b4-6b1a-4f2f-9c0a-0b5f6a2d0e11"

	cursor := encodeCursor(domain.Timelapse{ID: id, PublishedAt: &at})
	if cursor == "" {
		t.Fatal("a published row produced no cursor")
	}

	gotAt, gotID, err := decodeCursor(cursor)
	if err != nil {
		t.Fatalf("decodeCursor: %v", err)
	}
	if !gotAt.Equal(at) {
		t.Errorf("cursor round trip gave time %v, want %v", gotAt, at)
	}
	if *gotID != id {
		t.Errorf("cursor round trip gave id %q, want %q", *gotID, id)
	}
}

func TestEmptyCursorMeansFirstPage(t *testing.T) {
	at, id, err := decodeCursor("")
	if err != nil || at != nil || id != nil {
		t.Fatalf("empty cursor gave (%v, %v, %v), want all nil", at, id, err)
	}
}

func TestMalformedCursorsAreRejected(t *testing.T) {
	// A cursor is client-supplied, so anything that is not one of ours has to
	// come back as an error rather than silently paging from the beginning.
	for _, bad := range []string{"not-a-cursor", "!!!!", "aGVsbG8"} {
		if _, _, err := decodeCursor(bad); err == nil {
			t.Errorf("cursor %q was accepted", bad)
		}
	}
}

func TestPaginateTrimsTheProbeRow(t *testing.T) {
	at := time.Now().UTC()
	rows := make([]domain.Timelapse, 4)
	for i := range rows {
		rows[i] = domain.Timelapse{ID: "id", PublishedAt: &at}
	}

	// Four rows fetched for a limit of three: the fourth exists only to prove
	// there is a next page, and must not be returned.
	page := paginate(rows, 3)
	if len(page.Items) != 3 {
		t.Errorf("got %d items, want 3", len(page.Items))
	}
	if page.NextCursor == "" {
		t.Error("no cursor returned when a further page exists")
	}

	// Exactly at the limit means this is the last page.
	page = paginate(rows[:3], 3)
	if page.NextCursor != "" {
		t.Error("a cursor was returned on the last page")
	}
}
