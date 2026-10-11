// Package store is the only place SQL is written. Handlers call methods here;
// they never build queries themselves.
//
// Every statement uses bound parameters. String interpolation into SQL is not
// permitted anywhere in this package, which is what keeps injection off the
// table structurally rather than by review.
package store

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("store: not found")

// ErrConflict is returned when a uniqueness constraint rejects a write.
var ErrConflict = errors.New("store: conflict")

// ErrNotPublished is returned when an operation only makes sense for work the
// public can see — featuring, most obviously.
var ErrNotPublished = errors.New("store: not published")

// ErrShelfFull is returned when the curated front page has no room left. It is
// distinct from a generic conflict because the operator can act on it: unfeature
// something first.
var ErrShelfFull = errors.New("store: the front page is full")

// Store holds the pool and exposes one method per query the API needs.
type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Pool exposes the underlying pool for health checks.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// tx runs fn inside a transaction, rolling back on any error or panic.
// Multi-table writes — a video and its tags, a sponsorship and its counters —
// go through here so a partial write can never be observed.
func (s *Store) tx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// normalize maps driver errors onto the package's sentinel errors so callers
// do not have to know pgx exists.
func normalize(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return fmt.Errorf("%w: %s", ErrConflict, pgErr.ConstraintName)
		case "23503": // foreign_key_violation
			return fmt.Errorf("%w: referenced row is missing", ErrConflict)
		case "23514": // check_violation
			return fmt.Errorf("%w: value failed a constraint", ErrConflict)
		}
	}
	return err
}

// isUniqueViolationOn reports whether err is a unique violation whose
// constraint name mentions the given column.
func isUniqueViolationOn(err error, column string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, column)
	}
	return errors.Is(err, ErrConflict) && strings.Contains(err.Error(), column)
}

// nullIP renders an invalid address as SQL NULL.
func nullIP(a netip.Addr) any {
	if !a.IsValid() {
		return nil
	}
	return a
}

// nullText renders an empty string as SQL NULL, keeping empty and absent
// distinguishable in the database.
func nullText(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
