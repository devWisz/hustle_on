package store

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

// timelapseColumns is the projection every timelapse read shares. Which of
// these fields survive into JSON is decided per audience in the handlers; the
// query itself stays identical so the shapes cannot drift.
const timelapseColumns = `t.id::text, t.slug, t.title, t.summary,
	COALESCE(t.github_url, ''), COALESCE(t.x_url, ''), t.status::text,
	COALESCE(t.thumbnail_url, ''), COALESCE(t.playback_url, ''),
	COALESCE(t.duration_seconds, 0), COALESCE(t.session_minutes, 0),
	t.view_count, t.donation_count, t.donation_total_lamports,
	COALESCE(t.review_note, ''), t.submitted_at, t.published_at, t.created_at,
	u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, ''),
	t.featured_at IS NOT NULL`

const timelapseFrom = ` FROM timelapses t JOIN users u ON u.id = t.user_id`

// timelapseScanTargets lists the destinations for one row of timelapseColumns,
// in order.
//
// It exists so a query that selects the shared projection *plus* a column of its
// own — the saved-list needs the bookmark's timestamp — can append one more
// target instead of restating all twenty-two and slowly drifting from them.
func timelapseScanTargets(t *domain.Timelapse) []any {
	return []any{&t.ID, &t.Slug, &t.Title, &t.Summary,
		&t.GitHubURL, &t.XURL, &t.Status,
		&t.ThumbnailURL, &t.PlaybackURL, &t.DurationSecs, &t.SessionMinutes,
		&t.ViewCount, &t.DonationCount, &t.DonationTotal,
		&t.ReviewNote, &t.SubmittedAt, &t.PublishedAt, &t.CreatedAt,
		&t.Creator.ID, &t.Creator.Handle, &t.Creator.DisplayName, &t.Creator.AvatarURL,
		&t.Featured}
}

// resolveMedia turns stored media references into loadable URLs. It is set at
// startup to the storage signer; the default leaves values untouched.
var resolveMedia = func(ref string) string { return ref }

// SetMediaResolver installs the function that signs private media references.
func SetMediaResolver(f func(string) string) { resolveMedia = f }

func resolveTimelapseMedia(t *domain.Timelapse) {
	t.PlaybackURL = resolveMedia(t.PlaybackURL)
	t.ThumbnailURL = resolveMedia(t.ThumbnailURL)
}

func scanTimelapse(row pgx.Row) (domain.Timelapse, error) {
	var t domain.Timelapse
	err := row.Scan(timelapseScanTargets(&t)...)
	if err == nil {
		resolveTimelapseMedia(&t)
	}
	return t, err
}

func collectTimelapses(rows pgx.Rows) ([]domain.Timelapse, error) {
	defer rows.Close()
	out := []domain.Timelapse{}
	for rows.Next() {
		t, err := scanTimelapse(rows)
		if err != nil {
			return nil, normalize(err)
		}
		out = append(out, t)
	}
	return out, normalize(rows.Err())
}

// FeedSort names the orders the public feed can be read in. The zero value is
// the default, so a caller that does not care gets newest-first.
type FeedSort string

const (
	// FeedRecent is newest first. The only order with a stable sort key, and
	// therefore the only one that pages.
	FeedRecent FeedSort = ""
	// FeedFunded ranks by SOL received.
	FeedFunded FeedSort = "funded"
	// FeedWatched ranks by view count.
	FeedWatched FeedSort = "watched"
	// FeedLongest ranks by the length of the session that was recorded.
	FeedLongest FeedSort = "longest"
)

// ParseFeedSort maps a query-string value onto a sort. An unrecognised value
// falls back to the default rather than erroring: a stale bookmark should still
// render a feed.
func ParseFeedSort(v string) FeedSort {
	switch FeedSort(strings.ToLower(strings.TrimSpace(v))) {
	case FeedFunded:
		return FeedFunded
	case FeedWatched:
		return FeedWatched
	case FeedLongest:
		return FeedLongest
	default:
		return FeedRecent
	}
}

// FeedQuery is the set of things a visitor can ask the feed for.
type FeedQuery struct {
	Cursor string
	Limit  int
	// Search matches the title, the summary and the creator's name. Empty
	// means no filtering.
	Search string
	Sort   FeedSort
}

// orderBy is the ORDER BY for this sort. The strings are constants chosen by
// the switch, never assembled from input, so no caller can reach the SQL.
func (q FeedQuery) orderBy() string {
	switch q.Sort {
	case FeedFunded:
		return "t.donation_total_lamports DESC, t.published_at DESC, t.id DESC"
	case FeedWatched:
		return "t.view_count DESC, t.published_at DESC, t.id DESC"
	case FeedLongest:
		return "t.session_minutes DESC, t.published_at DESC, t.id DESC"
	default:
		return "t.published_at DESC, t.id DESC"
	}
}

// pages reports whether this query can hand out a cursor.
//
// Only the default order can. The other three rank on a column that changes
// underneath the reader — a donation lands, a view is counted — and a keyset
// cursor over a moving value silently skips and repeats rows. Ranked views
// return a single page instead of quietly lying about what comes next.
func (q FeedQuery) pages() bool { return q.Sort == FeedRecent }

// Feed returns published timelapses.
//
// Paging is keyset rather than OFFSET: the cursor names the last row seen, so a
// donation landing between two page loads cannot shuffle a row from page two
// onto page one, and the cost of page fifty is the same as page one.
func (s *Store) Feed(ctx context.Context, q FeedQuery) (domain.Page[domain.Timelapse], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	// A cursor and a ranked order cannot be combined; the cursor is simply
	// dropped, since there was no honest page two to resume from.
	if !q.pages() {
		before, beforeID = nil, nil
	}

	search := likePattern(q.Search)

	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE t.status = 'published'
		  AND ($1::timestamptz IS NULL OR (t.published_at, t.id) < ($1, $2::uuid))
		  AND ($4::text IS NULL
		       OR t.title ILIKE $4 ESCAPE '\'
		       OR t.summary ILIKE $4 ESCAPE '\'
		       OR u.display_name ILIKE $4 ESCAPE '\'
		       OR u.handle::text ILIKE $4 ESCAPE '\')
		ORDER BY `+q.orderBy()+`
		LIMIT $3`, before, beforeID, q.Limit+1, search)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, normalize(err)
	}
	items, err := collectTimelapses(rows)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	if !q.pages() {
		if len(items) > q.Limit {
			items = items[:q.Limit]
		}
		return domain.Page[domain.Timelapse]{Items: items}, nil
	}
	return paginate(items, q.Limit), nil
}

// likePattern turns a search term into a bounded ILIKE pattern, or nil when
// there is nothing to search for.
//
// The wildcards a visitor types are escaped rather than honoured: a lone "%"
// in the box should find nothing, not scan the whole table, and a "_" should
// mean the underscore in a file name. The term is also capped, because the
// pattern length is what the match costs.
func likePattern(term string) *string {
	term = strings.TrimSpace(term)
	if term == "" {
		return nil
	}
	if len(term) > 80 {
		term = term[:80]
	}
	r := strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)
	pattern := "%" + r.Replace(term) + "%"
	return &pattern
}

// BySlug returns one timelapse regardless of status. Callers decide who may see
// a row that is not published; this method does not, because the creator's own
// dashboard and the review queue both need to read unpublished rows.
func (s *Store) BySlug(ctx context.Context, slug string) (domain.Timelapse, error) {
	t, err := scanTimelapse(s.pool.QueryRow(ctx,
		`SELECT `+timelapseColumns+timelapseFrom+` WHERE t.slug = $1`, slug))
	return t, normalize(err)
}

// ByID returns one timelapse by primary key.
func (s *Store) ByID(ctx context.Context, id string) (domain.Timelapse, error) {
	t, err := scanTimelapse(s.pool.QueryRow(ctx,
		`SELECT `+timelapseColumns+timelapseFrom+` WHERE t.id = $1`, id))
	return t, normalize(err)
}

// CreatorTimelapses lists a creator's published work, newest first.
//
// The cursor is (published_at, id) — the same pair the ORDER BY uses. Paging a
// public profile on a timestamp alone would be unstable, because two sessions
// published in the same transaction share one, and a page boundary between them
// would be arbitrary.
func (s *Store) CreatorTimelapses(ctx context.Context, handle string, q PageQuery) (domain.Page[domain.Timelapse], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE u.handle = $1 AND t.status = 'published'
		  AND ($2::timestamptz IS NULL OR (t.published_at, t.id) < ($2, $3::uuid))
		ORDER BY t.published_at DESC, t.id DESC
		LIMIT $4`, handle, before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, normalize(err)
	}
	items, err := collectTimelapses(rows)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	return paginate(items, q.Limit), nil
}

// MyTimelapses lists everything an account has, in any state, so the dashboard
// can show drafts and rejections alongside published work.
//
// Ordered by when the draft was created, which is the only timestamp every row
// in the list has: a draft has never been published, so published_at is null.
func (s *Store) MyTimelapses(ctx context.Context, userID string, q PageQuery) (domain.Page[domain.Timelapse], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE t.user_id = $1 AND t.status <> 'removed'
		  AND ($2::timestamptz IS NULL OR (t.created_at, t.id) < ($2, $3::uuid))
		ORDER BY t.created_at DESC, t.id DESC
		LIMIT $4`, userID, before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, normalize(err)
	}
	items, err := collectTimelapses(rows)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	return pageOf(items, q.Limit, func(t domain.Timelapse) string {
		return encodeTimelapseCursor(t, &t.CreatedAt)
	}), nil
}

// ReviewQueue lists submissions awaiting a decision, oldest first: whoever has
// been waiting longest is next.
//
// Paging forward runs in the same direction as the order — `>` rather than `<`
// — so the second page is the *next* oldest, not the newest.
func (s *Store) ReviewQueue(ctx context.Context, q PageQuery) (domain.Page[domain.Timelapse], error) {
	after, afterID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE t.status = 'in_review'
		  AND ($1::timestamptz IS NULL OR (t.submitted_at, t.id) > ($1, $2::uuid))
		ORDER BY t.submitted_at ASC, t.id ASC
		LIMIT $3`, after, afterID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, normalize(err)
	}
	items, err := collectTimelapses(rows)
	if err != nil {
		return domain.Page[domain.Timelapse]{}, err
	}
	return pageOf(items, q.Limit, func(t domain.Timelapse) string {
		return encodeTimelapseCursor(t, t.SubmittedAt)
	}), nil
}

// NewTimelapse is the input for creating a draft.
type NewTimelapse struct {
	UserID         string
	Slug           string
	Title          string
	Summary        string
	GitHubURL      string
	XURL           string
	StorageKey     string
	SessionMinutes int
}

// Create inserts a draft. The row exists before any bytes do, which is what
// gives the upload URL an owner to be issued against.
func (s *Store) Create(ctx context.Context, in NewTimelapse) (domain.Timelapse, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO timelapses (user_id, slug, title, summary, github_url, x_url,
		                        storage_key, session_minutes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text`,
		in.UserID, in.Slug, in.Title, in.Summary,
		nullText(in.GitHubURL), nullText(in.XURL), nullText(in.StorageKey), in.SessionMinutes).Scan(&id)
	if err != nil {
		return domain.Timelapse{}, normalize(err)
	}
	return s.ByID(ctx, id)
}

// TimelapseUpdate carries the fields a creator may edit before submitting.
type TimelapseUpdate struct {
	Title          *string
	Summary        *string
	GitHubURL      *string
	XURL           *string
	SessionMinutes *int
}

// Update edits a draft or a rejected submission.
//
// The status predicate is the authorisation, not a convenience: a creator
// cannot rewrite the write-up of something already approved, and cannot edit a
// row out from under a reviewer who is looking at it.
func (s *Store) Update(ctx context.Context, id, userID string, up TimelapseUpdate) (domain.Timelapse, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE timelapses SET
			title           = COALESCE($3, title),
			summary         = COALESCE($4, summary),
			github_url      = COALESCE(NULLIF($5, ''), github_url),
			x_url           = COALESCE(NULLIF($6, ''), x_url),
			session_minutes = COALESCE($7, session_minutes)
		WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'uploaded', 'rejected')`,
		id, userID, up.Title, up.Summary,
		derefOr(up.GitHubURL), derefOr(up.XURL), up.SessionMinutes)
	if err != nil {
		return domain.Timelapse{}, normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.Timelapse{}, ErrNotFound
	}
	return s.ByID(ctx, id)
}

// MarkUploaded records that the bytes arrived and stores the playback URL.
func (s *Store) MarkUploaded(ctx context.Context, id, userID, playbackURL string, byteSize int64, durationSeconds int) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE timelapses
		SET status = 'uploaded', playback_url = $3, byte_size = $4, duration_seconds = $5
		WHERE id = $1 AND user_id = $2 AND status = 'draft'`,
		id, userID, playbackURL, byteSize, durationSeconds)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Submit moves an upload into the review queue.
//
// Only a row that already has media and has not been submitted can move, so a
// creator cannot queue an empty draft, and resubmitting clears the previous
// decision rather than leaving a stale rejection attached to a fresh attempt.
func (s *Store) Submit(ctx context.Context, id, userID string, at time.Time) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE timelapses
		SET status = 'in_review', submitted_at = $3,
		    review_note = NULL, reviewed_by = NULL, reviewed_at = NULL
		WHERE id = $1 AND user_id = $2
		  AND status IN ('uploaded', 'rejected')
		  AND playback_url IS NOT NULL`,
		id, userID, at)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Approve publishes a submission and credits the creator's published count.
//
// Both writes happen in one transaction: a published row whose creator's count
// does not include it would be visibly wrong on the profile it appears on.
func (s *Store) Approve(ctx context.Context, id, reviewerID string, at time.Time) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var creatorID string
		err := tx.QueryRow(ctx, `
			UPDATE timelapses
			SET status = 'published', published_at = $3, reviewed_by = $2, reviewed_at = $3,
			    review_note = NULL
			WHERE id = $1 AND status = 'in_review'
			RETURNING user_id::text`, id, reviewerID, at).Scan(&creatorID)
		if err != nil {
			return normalize(err)
		}
		_, err = tx.Exec(ctx,
			`UPDATE users SET timelapse_count = timelapse_count + 1 WHERE id = $1`, creatorID)
		return normalize(err)
	})
}

// Reject declines a submission with a reason the creator will read.
func (s *Store) Reject(ctx context.Context, id, reviewerID, note string, at time.Time) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE timelapses
		SET status = 'rejected', review_note = $3, reviewed_by = $2, reviewed_at = $4
		WHERE id = $1 AND status = 'in_review'`,
		id, reviewerID, note, at)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Remove withdraws a timelapse.
//
// The row is kept rather than deleted, because donations reference it and a
// supporter's record of what they gave to must not disappear. A published row
// being withdrawn also gives the creator's count back.
func (s *Store) Remove(ctx context.Context, id, userID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		// The old status has to be read before the UPDATE overwrites it, since
		// only a row that was published should give a count back.
		var creatorID, status string
		err := tx.QueryRow(ctx, `
			SELECT user_id::text, status::text FROM timelapses
			WHERE id = $1 AND ($2 = '' OR user_id = $2::uuid) AND status <> 'removed'
			FOR UPDATE`, id, userID).Scan(&creatorID, &status)
		if err != nil {
			return normalize(err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE timelapses SET status = 'removed' WHERE id = $1`, id); err != nil {
			return normalize(err)
		}
		if status == "published" {
			_, err = tx.Exec(ctx,
				`UPDATE users SET timelapse_count = greatest(timelapse_count - 1, 0) WHERE id = $1`,
				creatorID)
		}
		return normalize(err)
	})
}

// RecordView counts a viewer at most once per day.
//
// The unique indexes on timelapse_views do the deduplication, so a refresh loop
// inserts nothing and the counter below is only touched when the insert was
// genuinely new.
func (s *Store) RecordView(ctx context.Context, timelapseID, viewerID string, fingerprint []byte) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			INSERT INTO timelapse_views (timelapse_id, viewer_id, viewer_fingerprint)
			VALUES ($1, NULLIF($2,'')::uuid, $3)
			ON CONFLICT DO NOTHING`, timelapseID, viewerID, fingerprint)
		if err != nil {
			return normalize(err)
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		_, err = tx.Exec(ctx,
			`UPDATE timelapses SET view_count = view_count + 1 WHERE id = $1`, timelapseID)
		return normalize(err)
	})
}

// StorageKey returns the object key recorded for a timelapse. The key is never
// part of any JSON payload; it is read here so the API can check ownership and
// build the playback URL itself rather than trusting a client to supply either.
func (s *Store) StorageKey(ctx context.Context, id string) (string, error) {
	var key string
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(storage_key, '') FROM timelapses WHERE id = $1`, id).Scan(&key)
	return key, normalize(err)
}

// SlugTaken reports whether a slug is already in use.
func (s *Store) SlugTaken(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM timelapses WHERE slug = $1)`, slug).Scan(&exists)
	return exists, normalize(err)
}

// --- cursor helpers -------------------------------------------------------

// paginate trims the extra row a keyset query fetches to detect a next page,
// and turns it into a cursor.
func paginate(items []domain.Timelapse, limit int) domain.Page[domain.Timelapse] {
	return pageOf(items, limit, encodeCursor)
}

// encodeCursor packs the sort key of the last row seen: the timestamp it was
// ordered by, then its id. The id is not decoration — without it, two rows
// published in the same transaction have no defined order between them, and a
// page boundary landing between them would repeat or drop one.
func encodeCursor(t domain.Timelapse) string {
	return encodeTimelapseCursor(t, t.PublishedAt)
}

// encodeTimelapseCursor builds a cursor from a timelapse and the timestamp the
// list it came from was ordered by. It returns the empty string when that
// timestamp is null, which ends paging honestly rather than looping.
func encodeTimelapseCursor(t domain.Timelapse, at *time.Time) string {
	if at == nil {
		return ""
	}
	return encodeKeyset(keysetTime(*at), t.ID)
}

func decodeCursor(cursor string) (*time.Time, *string, error) {
	return decodeTimeIDCursor(cursor)
}

// derefOr renders a nil pointer as the empty string, which the UPDATE above
// reads as "leave this column alone".
func derefOr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
