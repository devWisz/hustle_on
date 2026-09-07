package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

const commentSelect = `
	SELECT c.id::text, c.video_id::text, COALESCE(c.parent_id::text,''), c.body,
	       c.like_count, c.reply_count, c.edited_at, c.created_at,
	       u.id::text, u.handle::text, u.display_name, COALESCE(p.avatar_url,'')
	FROM comments c
	JOIN users u ON u.id = c.user_id
	JOIN profiles p ON p.user_id = u.id`

func scanComment(row pgx.Row) (domain.Comment, error) {
	var c domain.Comment
	err := row.Scan(&c.ID, &c.VideoID, &c.ParentID, &c.Body, &c.LikeCount, &c.ReplyCount,
		&c.EditedAt, &c.CreatedAt,
		&c.Author.ID, &c.Author.Handle, &c.Author.DisplayName, &c.Author.AvatarURL)
	return c, err
}

// AddComment inserts a comment and keeps both counters consistent in one
// transaction. Replies to a reply are flattened onto the top-level parent, so
// threads stay one level deep and readable.
func (s *Store) AddComment(ctx context.Context, videoID, userID, parentID, body string) (domain.Comment, error) {
	var out domain.Comment
	err := s.tx(ctx, func(tx pgx.Tx) error {
		if parentID != "" {
			var grandparent *string
			var parentVideo string
			if err := tx.QueryRow(ctx,
				`SELECT parent_id::text, video_id::text FROM comments
				 WHERE id = $1 AND status = 'visible'`, parentID).Scan(&grandparent, &parentVideo); err != nil {
				return normalize(err)
			}
			if parentVideo != videoID {
				return ErrNotFound
			}
			if grandparent != nil && *grandparent != "" {
				parentID = *grandparent
			}
		}

		var id string
		if err := tx.QueryRow(ctx, `
			INSERT INTO comments (video_id, user_id, parent_id, body)
			VALUES ($1, $2, NULLIF($3,'')::uuid, $4)
			RETURNING id::text`, videoID, userID, parentID, body).Scan(&id); err != nil {
			return normalize(err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE videos SET comment_count = comment_count + 1 WHERE id = $1`, videoID); err != nil {
			return normalize(err)
		}
		if parentID != "" {
			if _, err := tx.Exec(ctx,
				`UPDATE comments SET reply_count = reply_count + 1 WHERE id = $1`, parentID); err != nil {
				return normalize(err)
			}
		}
		var err error
		out, err = scanComment(tx.QueryRow(ctx, commentSelect+` WHERE c.id = $1`, id))
		return normalize(err)
	})
	return out, err
}

// CommentsForVideo returns top-level comments newest first, each with its
// replies. Two queries rather than N+1: one for parents, one for all replies.
func (s *Store) CommentsForVideo(ctx context.Context, videoID string, limit, offset int) ([]domain.Comment, error) {
	rows, err := s.pool.Query(ctx, commentSelect+`
		WHERE c.video_id = $1 AND c.parent_id IS NULL AND c.status = 'visible'
		ORDER BY c.created_at DESC
		LIMIT $2 OFFSET $3`, videoID, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	parents := []domain.Comment{}
	ids := []string{}
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, normalize(err)
		}
		c.Replies = []domain.Comment{}
		parents = append(parents, c)
		ids = append(ids, c.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, normalize(err)
	}
	if len(ids) == 0 {
		return parents, nil
	}

	replyRows, err := s.pool.Query(ctx, commentSelect+`
		WHERE c.parent_id = ANY($1::uuid[]) AND c.status = 'visible'
		ORDER BY c.created_at`, ids)
	if err != nil {
		return nil, normalize(err)
	}
	defer replyRows.Close()

	byParent := map[string][]domain.Comment{}
	for replyRows.Next() {
		c, err := scanComment(replyRows)
		if err != nil {
			return nil, normalize(err)
		}
		byParent[c.ParentID] = append(byParent[c.ParentID], c)
	}
	if err := replyRows.Err(); err != nil {
		return nil, normalize(err)
	}
	for i := range parents {
		if r, ok := byParent[parents[i].ID]; ok {
			parents[i].Replies = r
		}
	}
	return parents, nil
}

// DeleteComment soft-deletes a comment the caller owns.
func (s *Store) DeleteComment(ctx context.Context, commentID, userID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var videoID string
		err := tx.QueryRow(ctx, `
			UPDATE comments SET status = 'deleted', body = '[removed]'
			WHERE id = $1 AND user_id = $2 AND status = 'visible'
			RETURNING video_id::text`, commentID, userID).Scan(&videoID)
		if err != nil {
			return normalize(err)
		}
		_, err = tx.Exec(ctx,
			`UPDATE videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1`, videoID)
		return normalize(err)
	})
}

// LikeComment toggles a like and returns the resulting count.
func (s *Store) LikeComment(ctx context.Context, commentID, userID string, like bool) (int, error) {
	var count int
	err := s.tx(ctx, func(tx pgx.Tx) error {
		var tagRows int64
		if like {
			tag, err := tx.Exec(ctx, `
				INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)
				ON CONFLICT DO NOTHING`, commentID, userID)
			if err != nil {
				return normalize(err)
			}
			tagRows = tag.RowsAffected()
		} else {
			tag, err := tx.Exec(ctx,
				`DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, commentID, userID)
			if err != nil {
				return normalize(err)
			}
			tagRows = -tag.RowsAffected()
		}
		return normalize(tx.QueryRow(ctx, `
			UPDATE comments SET like_count = GREATEST(like_count + $2, 0)
			WHERE id = $1 RETURNING like_count`, commentID, tagRows).Scan(&count))
	})
	return count, err
}
