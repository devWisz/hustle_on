package store

import (
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

// Paging in this package is keyset, never OFFSET.
//
// A cursor names the sort key of the last row the caller has seen, so the cost
// of page fifty is the same as page one, and a row inserted between two page
// loads cannot shuffle an already-seen row onto a later page or skip one
// entirely. OFFSET would do both, and would also let a client make the database
// walk a million rows just to throw them away.
//
// Every cursor is scoped to the query that produced it: it carries the columns
// that query ordered by, in that order. A cursor from one endpoint therefore
// cannot be handed to another in a way that means something unintended — the
// number of fields is checked and a mismatch is rejected outright.

// ErrBadCursor is returned when a cursor cannot be decoded, so handlers can turn
// it into a 400 rather than silently serving page one again.
var ErrBadCursor = errors.New("store: cursor is not valid")

// PageQuery is the paging half of a list request: where to resume and how much
// to return. It is embedded in each list query's own options struct so the
// filter and the paging travel together.
type PageQuery struct {
	// Cursor is the token the previous page returned as nextCursor. Empty
	// means "start at the beginning".
	Cursor string
	// Limit is the maximum number of rows to return. The caller is responsible
	// for clamping it; the store fetches one extra row to detect a next page.
	Limit int
}

// cursorSep separates the fields of a cursor's payload. None of the values
// packed here — RFC 3339 timestamps, UUIDs, decimal integers — can contain it,
// so the split is unambiguous.
const cursorSep = "|"

// encodeKeyset packs the sort key of the last row seen.
//
// The result is base64 so that it reads as an opaque token: clients pass it back
// unchanged rather than parsing it and inventing their own.
func encodeKeyset(parts ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(parts, cursorSep)))
}

// decodeKeyset splits a cursor into exactly want fields.
//
// A cursor that does not decode, that has the wrong number of fields, or that
// contains an empty field is rejected: it was not produced by this query, and
// guessing what the caller meant would page from an arbitrary position.
func decodeKeyset(cursor string, want int) ([]string, error) {
	if cursor == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, ErrBadCursor
	}
	parts := strings.Split(string(raw), cursorSep)
	if len(parts) != want {
		return nil, ErrBadCursor
	}
	for _, p := range parts {
		if p == "" {
			return nil, ErrBadCursor
		}
	}
	return parts, nil
}

// decodeTimeIDCursor decodes the two-field cursor most lists use: the timestamp
// the query ordered by, and the row id that breaks ties between rows sharing it.
func decodeTimeIDCursor(cursor string) (at *time.Time, id *string, err error) {
	parts, err := decodeKeyset(cursor, 2)
	if err != nil || parts == nil {
		return nil, nil, err
	}
	when, err := parseKeysetTime(parts[0])
	if err != nil {
		return nil, nil, err
	}
	return &when, &parts[1], nil
}

// decodeRankCursor decodes the three-field cursor a ranked list uses: the
// ranking value, the timestamp, and the row id.
//
// The ranking value is part of the key because it is the first thing the order
// sorts on. A cursor without it could only say "after this timestamp", which is
// not where the reader stopped: plenty of sessions share a donation total, and
// resuming on the timestamp would skip every one of them that ranked level with
// the last row seen.
func decodeRankCursor(cursor string) (rank *int64, at *time.Time, id *string, err error) {
	parts, err := decodeKeyset(cursor, 3)
	if err != nil || parts == nil {
		return nil, nil, nil, err
	}
	value, err := parseKeysetInt(parts[0])
	if err != nil {
		return nil, nil, nil, err
	}
	when, err := parseKeysetTime(parts[1])
	if err != nil {
		return nil, nil, nil, err
	}
	return &value, &when, &parts[2], nil
}

// keysetTime renders a timestamp for a cursor at the precision Postgres stores,
// so the value read back out of a timestamptz column round trips exactly.
func keysetTime(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

func parseKeysetTime(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}, ErrBadCursor
	}
	return t, nil
}

func keysetInt(n int64) string { return strconv.FormatInt(n, 10) }

func parseKeysetInt(s string) (int64, error) {
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, ErrBadCursor
	}
	return n, nil
}

// pageOf trims the extra probe row a keyset query fetches to learn whether a
// next page exists, and mints the next cursor from the last row it kept.
//
// Every list endpoint ends here, so the envelope is built in exactly one place
// and no endpoint can return a cursor that points at a row it just handed out.
func pageOf[T any](items []T, limit int, cursor func(T) string) domain.Page[T] {
	if limit < 1 {
		limit = 1
	}
	if len(items) <= limit {
		return domain.Page[T]{Items: items}
	}
	next := cursor(items[limit-1])
	items = items[:limit]
	return domain.Page[T]{Items: items, NextCursor: next}
}
