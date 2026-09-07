package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

const videoSelect = `
	SELECT v.id::text, v.slug, v.title, COALESCE(v.description,''), v.status::text,
	       v.visibility::text, COALESCE(v.thumbnail_url,''), COALESCE(v.playback_url,''),
	       COALESCE(v.duration_seconds,0), COALESCE(v.session_minutes,0),
	       v.view_count, v.comment_count, v.sponsor_count, v.sponsor_total_lamports,
	       v.published_at, v.created_at,
	       u.id::text, u.handle::text, u.display_name, COALESCE(p.avatar_url,''),
	       COALESCE((SELECT w.address FROM wallets w WHERE w.user_id = u.id AND w.is_primary LIMIT 1), ''),
	       COALESCE(ARRAY(SELECT t.name::text FROM video_tags vt
	                      JOIN tags t ON t.id = vt.tag_id
	                      WHERE vt.video_id = v.id ORDER BY t.name), '{}')
	FROM videos v
	JOIN users u ON u.id = v.user_id
	JOIN profiles p ON p.user_id = u.id`

func scanVideo(row pgx.Row) (domain.Video, error) {
	var v domain.Video
	err := row.Scan(&v.ID, &v.Slug, &v.Title, &v.Description, &v.Status, &v.Visibility,
		&v.ThumbnailURL, &v.PlaybackURL, &v.DurationSecs, &v.SessionMinutes,
		&v.ViewCount, &v.CommentCount, &v.SponsorCount, &v.SponsorTotal,
		&v.PublishedAt, &v.CreatedAt,
		&v.Creator.ID, &v.Creator.Handle, &v.Creator.DisplayName, &v.Creator.AvatarURL,
		&v.Creator.Wallet, &v.Tags)
	return v, err
}

// NewVideo is the input for reserving an upload slot.
type NewVideo struct {
	UserID         string
	Slug           string
	Title          string
	Description    string
	SessionMinutes int
	Visibility     string
	StorageKey     string
	Tags           []string
}

// CreateDraft reserves the row and its tags before any bytes are uploaded, so
// the storage key is bound to a known owner from the start.
func (s *Store) CreateDraft(ctx context.Context, in NewVideo) (string, error) {
	var id string
	err := s.tx(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `
			INSERT INTO videos (user_id, slug, title, description, session_minutes,
			                    visibility, storage_key, status)
			VALUES ($1, $2, $3, $4, $5, $6::video_visibility, $7, 'draft')
			RETURNING id::text`,
			in.UserID, in.Slug, in.Title, nullText(in.Description),
			in.SessionMinutes, in.Visibility, in.StorageKey).Scan(&id); err != nil {
			return normalize(err)
		}
		return attachTags(ctx, tx, id, in.Tags)
	})
	return id, err
}

func attachTags(ctx context.Context, tx pgx.Tx, videoID string, tags []string) error {
	if len(tags) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO tags (name) SELECT unnest($1::text[])::citext
		ON CONFLICT (name) DO NOTHING`, tags); err != nil {
		return normalize(err)
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO video_tags (video_id, tag_id)
		SELECT $1, t.id FROM tags t WHERE t.name = ANY($2::citext[])
		ON CONFLICT DO NOTHING`, videoID, tags)
	return normalize(err)
}

// MarkUploaded records the received object and moves the row into processing.
func (s *Store) MarkUploaded(ctx context.Context, videoID, userID string, size int64, checksum []byte) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE videos SET status = 'processing', byte_size = $3, checksum_sha256 = $4
		WHERE id = $1 AND user_id = $2 AND status = 'draft'`,
		videoID, userID, size, checksum)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Transcoded stores the outputs of the media pipeline.
func (s *Store) Transcoded(ctx context.Context, videoID, playbackURL, thumbURL string, duration, width, height int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE videos SET playback_url = $2, thumbnail_url = $3, duration_seconds = $4,
		                  width = $5, height = $6, status = 'uploaded'
		WHERE id = $1`, videoID, playbackURL, thumbURL, duration, width, height)
	return normalize(err)
}

// Publish makes a video visible and bumps the creator's video count.
func (s *Store) Publish(ctx context.Context, videoID, userID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE videos SET status = 'published', published_at = COALESCE(published_at, now())
			WHERE id = $1 AND user_id = $2 AND status IN ('uploaded', 'processing')`,
			videoID, userID)
		if err != nil {
			return normalize(err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		_, err = tx.Exec(ctx,
			`UPDATE profiles SET video_count = video_count + 1 WHERE user_id = $1`, userID)
		return normalize(err)
	})
}

// VideoBySlug returns a published video. viewerID may be empty; a non-public
// video is only returned to its owner.
func (s *Store) VideoBySlug(ctx context.Context, slug, viewerID string) (domain.Video, error) {
	v, err := scanVideo(s.pool.QueryRow(ctx, videoSelect+`
		WHERE v.slug = $1
		  AND u.status = 'active'
		  AND (
		        (v.status = 'published' AND v.visibility IN ('public','unlisted'))
		     OR ($2 <> '' AND v.user_id = $2::uuid)
		      )`, slug, viewerID))
	if err != nil {
		return domain.Video{}, normalize(err)
	}
	return v, nil
}

func (s *Store) VideoOwner(ctx context.Context, videoID string) (string, error) {
	var owner string
	err := s.pool.QueryRow(ctx, `SELECT user_id::text FROM videos WHERE id = $1`, videoID).Scan(&owner)
	return owner, normalize(err)
}

// FeedQuery is a keyset-paginated request for the public feed. Keyset paging is
// used rather than OFFSET so deep pages stay cheap and do not skip rows when
// new videos are published mid-scroll.
type FeedQuery struct {
	Before *time.Time
	Tag    string
	Search string
	Limit  int
}

func (s *Store) Feed(ctx context.Context, q FeedQuery) ([]domain.Video, error) {
	rows, err := s.pool.Query(ctx, videoSelect+`
		WHERE v.status = 'published'
		  AND v.visibility = 'public'
		  AND u.status = 'active'
		  AND ($1::timestamptz IS NULL OR v.published_at < $1)
		  AND ($2 = '' OR EXISTS (SELECT 1 FROM video_tags vt JOIN tags t ON t.id = vt.tag_id
		                          WHERE vt.video_id = v.id AND t.name = $2::citext))
		  AND ($3 = '' OR v.title ILIKE '%' || $3 || '%')
		ORDER BY v.published_at DESC
		LIMIT $4`, q.Before, q.Tag, q.Search, q.Limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	return collectVideos(rows)
}

// VideosByCreator lists a creator's videos. Owners additionally see drafts.
func (s *Store) VideosByCreator(ctx context.Context, handle, viewerID string, limit, offset int) ([]domain.Video, error) {
	rows, err := s.pool.Query(ctx, videoSelect+`
		WHERE u.handle = $1
		  AND u.status = 'active'
		  AND (
		        (v.status = 'published' AND v.visibility = 'public')
		     OR ($2 <> '' AND v.user_id = $2::uuid)
		      )
		ORDER BY COALESCE(v.published_at, v.created_at) DESC
		LIMIT $3 OFFSET $4`, handle, viewerID, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	return collectVideos(rows)
}

func collectVideos(rows pgx.Rows) ([]domain.Video, error) {
	out := []domain.Video{}
	for rows.Next() {
		v, err := scanVideo(rows)
		if err != nil {
			return nil, normalize(err)
		}
		out = append(out, v)
	}
	return out, normalize(rows.Err())
}

// RecordView appends a view and bumps the counter. The caller deduplicates
// before calling, so this is a plain append.
func (s *Store) RecordView(ctx context.Context, videoID, viewerID string, fingerprint []byte, watched int) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO video_views (video_id, viewer_id, viewer_fingerprint, watched_seconds)
			VALUES ($1, NULLIF($2,'')::uuid, $3, $4)`,
			videoID, viewerID, fingerprint, watched); err != nil {
			return normalize(err)
		}
		_, err := tx.Exec(ctx,
			`UPDATE videos SET view_count = view_count + 1 WHERE id = $1`, videoID)
		return normalize(err)
	})
}

// ViewedRecently reports whether this viewer already counted for this video
// today, so a refresh loop cannot inflate the count.
func (s *Store) ViewedRecently(ctx context.Context, videoID, viewerID string, fingerprint []byte) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM video_views
			WHERE video_id = $1
			  AND created_at > now() - interval '24 hours'
			  AND ((NULLIF($2,'')::uuid IS NOT NULL AND viewer_id = $2::uuid)
			       OR ($2 = '' AND viewer_fingerprint = $3))
		)`, videoID, viewerID, fingerprint).Scan(&exists)
	return exists, normalize(err)
}

// UpdateVideo edits the fields a creator may change after publishing.
func (s *Store) UpdateVideo(ctx context.Context, videoID, userID string, title, description *string, visibility *string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE videos SET
			title = COALESCE($3, title),
			description = COALESCE($4, description),
			visibility = COALESCE($5::video_visibility, visibility)
		WHERE id = $1 AND user_id = $2 AND status <> 'removed'`,
		videoID, userID, title, description, visibility)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RemoveVideo is a soft delete: the row stays so sponsorships that reference
// it keep their history.
func (s *Store) RemoveVideo(ctx context.Context, videoID, userID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE videos SET status = 'removed'
			WHERE id = $1 AND user_id = $2 AND status <> 'removed'`, videoID, userID)
		if err != nil {
			return normalize(err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		_, err = tx.Exec(ctx, `
			UPDATE profiles SET video_count = GREATEST(video_count - 1, 0) WHERE user_id = $1`, userID)
		return normalize(err)
	})
}
