package store

import (
	"errors"
	"testing"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

func TestKeysetRoundTripsEveryArity(t *testing.T) {
	at := time.Now().UTC().Truncate(time.Microsecond)
	id := "0c2ea1b4-6b1a-4f2f-9c0a-0b5f6a2d0e11"

	cases := [][]string{
		{keysetTime(at), id},
		{keysetInt(250000000), keysetTime(at), id},
	}
	for _, want := range cases {
		got, err := decodeKeyset(encodeKeyset(want...), len(want))
		if err != nil {
			t.Fatalf("decode %v: %v", want, err)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("field %d round-tripped to %q, want %q", i, got[i], want[i])
			}
		}
	}
}

// A cursor is scoped to the query that produced it. Handing a three-field
// donation cursor to a two-field list must fail rather than page from a
// position made of the wrong columns.
func TestCursorArityIsEnforced(t *testing.T) {
	cursor := encodeKeyset("1", "2", "3")
	if _, err := decodeKeyset(cursor, 2); !errors.Is(err, ErrBadCursor) {
		t.Fatalf("a 3-field cursor was accepted where 2 were expected: %v", err)
	}
	if _, err := decodeKeyset(cursor, 3); err != nil {
		t.Fatalf("the same cursor was rejected where 3 were expected: %v", err)
	}
}

func TestMalformedKeysetCursorsAreRejected(t *testing.T) {
	bad := []string{
		"not-base64!!",       // does not decode
		encodeKeyset("only"), // too few fields
		encodeKeyset(""),     // an empty field
		encodeKeyset("|"),    // two empty fields
	}
	for _, cursor := range bad {
		if _, err := decodeKeyset(cursor, 2); !errors.Is(err, ErrBadCursor) {
			t.Errorf("cursor %q was accepted", cursor)
		}
	}
}

func TestKeysetScalarsRejectForeignValues(t *testing.T) {
	if _, err := parseKeysetTime("yesterday"); !errors.Is(err, ErrBadCursor) {
		t.Error("a non-timestamp was accepted as a cursor field")
	}
	if _, err := parseKeysetInt("9.5"); !errors.Is(err, ErrBadCursor) {
		t.Error("a non-integer was accepted as a cursor field")
	}
}

// The cursor must point at the last row actually returned. Pointing at the
// probe row would skip it, and the caller would never see it on any page.
func TestPageOfCursorsTheLastRowKeptNotTheProbe(t *testing.T) {
	at := time.Now().UTC().Truncate(time.Microsecond)
	rows := make([]domain.Timelapse, 4)
	for i := range rows {
		rows[i] = domain.Timelapse{ID: string(rune('a' + i)), PublishedAt: &at}
	}

	page := pageOf(rows, 3, encodeCursor)
	if len(page.Items) != 3 {
		t.Fatalf("got %d items, want 3", len(page.Items))
	}
	if page.Items[2].ID != "c" {
		t.Fatalf("last kept row is %q, want c", page.Items[2].ID)
	}
	want := encodeCursor(rows[2])
	if page.NextCursor != want {
		t.Errorf("NextCursor = %q, want the cursor of row c", page.NextCursor)
	}
	// Decoding it must land on row c, not row d.
	gotAt, gotID, err := decodeCursor(page.NextCursor)
	if err != nil {
		t.Fatalf("decode the minted cursor: %v", err)
	}
	if *gotID != "c" || !gotAt.Equal(at) {
		t.Errorf("minted cursor points at (%v, %q), want row c", gotAt, *gotID)
	}
}

func TestPageOfEndsHonestly(t *testing.T) {
	at := time.Now().UTC()
	rows := make([]domain.Timelapse, 3)
	for i := range rows {
		rows[i] = domain.Timelapse{ID: "id", PublishedAt: &at}
	}

	// Exactly at the limit with no probe row: this is the last page, and saying
	// otherwise would make a client fetch an empty page forever.
	page := pageOf(rows, 3, encodeCursor)
	if page.NextCursor != "" {
		t.Error("a cursor was returned on the last page")
	}

	// A row with no sort key cannot produce a cursor; paging stops rather than
	// looping back to a null comparison.
	page = pageOf([]domain.Timelapse{{ID: "x"}, {ID: "y"}}, 1, encodeCursor)
	if len(page.Items) != 1 {
		t.Fatalf("got %d items, want 1", len(page.Items))
	}
	if page.NextCursor != "" {
		t.Errorf("a cursor was minted from a null sort key: %q", page.NextCursor)
	}
}

// A limit below one is a programming error, but it must not be a panic in a
// request path.
func TestPageOfSurvivesANonPositiveLimit(t *testing.T) {
	defer func() {
		if recover() != nil {
			t.Fatal("pageOf panicked on a limit below one")
		}
	}()
	at := time.Now().UTC()
	page := pageOf([]domain.Timelapse{{ID: "a", PublishedAt: &at}}, 0, encodeCursor)
	if len(page.Items) != 1 {
		t.Errorf("got %d items, want the single row", len(page.Items))
	}
}
