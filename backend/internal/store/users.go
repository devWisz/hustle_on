package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

const profileSelect = `
	SELECT u.id::text, u.handle::text, u.display_name, u.created_at,
	       COALESCE(p.headline,''), COALESCE(p.bio,''), COALESCE(p.location,''),
	       COALESCE(p.avatar_url,''), COALESCE(p.banner_url,''), p.skills,
	       p.open_to_work, p.hourly_rate_usd,
	       p.follower_count, p.video_count, p.sponsor_total_lamports,
	       COALESCE((SELECT w.address FROM wallets w
	                 WHERE w.user_id = u.id AND w.is_primary LIMIT 1), '')
	FROM users u
	JOIN profiles p ON p.user_id = u.id
	WHERE u.status = 'active'`

// ProfileByHandle returns the public profile for a handle, with social links.
func (s *Store) ProfileByHandle(ctx context.Context, handle string) (domain.PublicUser, error) {
	var u domain.PublicUser
	err := s.pool.QueryRow(ctx, profileSelect+` AND u.handle = $1`, handle).Scan(
		&u.ID, &u.Handle, &u.DisplayName, &u.JoinedAt,
		&u.Headline, &u.Bio, &u.Location, &u.AvatarURL, &u.BannerURL, &u.Skills,
		&u.OpenToWork, &u.HourlyRate,
		&u.FollowerCount, &u.VideoCount, &u.SponsorTotal, &u.PrimaryWallet)
	if err != nil {
		return domain.PublicUser{}, normalize(err)
	}
	links, err := s.SocialLinks(ctx, u.ID)
	if err != nil {
		return domain.PublicUser{}, err
	}
	u.SocialLinks = links
	return u, nil
}

// ProfileByID is the same lookup keyed by id, used for the signed-in user.
func (s *Store) ProfileByID(ctx context.Context, id string) (domain.PublicUser, error) {
	var u domain.PublicUser
	err := s.pool.QueryRow(ctx, profileSelect+` AND u.id = $1`, id).Scan(
		&u.ID, &u.Handle, &u.DisplayName, &u.JoinedAt,
		&u.Headline, &u.Bio, &u.Location, &u.AvatarURL, &u.BannerURL, &u.Skills,
		&u.OpenToWork, &u.HourlyRate,
		&u.FollowerCount, &u.VideoCount, &u.SponsorTotal, &u.PrimaryWallet)
	if err != nil {
		return domain.PublicUser{}, normalize(err)
	}
	links, err := s.SocialLinks(ctx, u.ID)
	if err != nil {
		return domain.PublicUser{}, err
	}
	u.SocialLinks = links
	return u, nil
}

func (s *Store) SocialLinks(ctx context.Context, userID string) ([]domain.SocialLink, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT platform::text, username, url, (verified_at IS NOT NULL)
		FROM social_links WHERE user_id = $1 ORDER BY platform`, userID)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	links := []domain.SocialLink{}
	for rows.Next() {
		var l domain.SocialLink
		if err := rows.Scan(&l.Platform, &l.Username, &l.URL, &l.Verified); err != nil {
			return nil, normalize(err)
		}
		links = append(links, l)
	}
	return links, normalize(rows.Err())
}

// ProfileUpdate carries the editable profile fields. Pointer fields are
// "leave unchanged" when nil, which keeps a partial update from blanking data
// the client never loaded.
type ProfileUpdate struct {
	DisplayName *string
	Headline    *string
	Bio         *string
	Location    *string
	AvatarURL   *string
	BannerURL   *string
	Skills      *[]string
	OpenToWork  *bool
	HourlyRate  *float64
}

func (s *Store) UpdateProfile(ctx context.Context, userID string, up ProfileUpdate) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return normalize(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if up.DisplayName != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE users SET display_name = $2 WHERE id = $1`, userID, *up.DisplayName); err != nil {
			return normalize(err)
		}
	}
	// COALESCE lets one statement handle every combination of provided fields
	// without assembling SQL by hand.
	if _, err := tx.Exec(ctx, `
		UPDATE profiles SET
			headline        = COALESCE($2, headline),
			bio             = COALESCE($3, bio),
			location        = COALESCE($4, location),
			avatar_url      = COALESCE($5, avatar_url),
			banner_url      = COALESCE($6, banner_url),
			skills          = COALESCE($7, skills),
			open_to_work    = COALESCE($8, open_to_work),
			hourly_rate_usd = COALESCE($9, hourly_rate_usd)
		WHERE user_id = $1`,
		userID, up.Headline, up.Bio, up.Location, up.AvatarURL, up.BannerURL,
		up.Skills, up.OpenToWork, up.HourlyRate); err != nil {
		return normalize(err)
	}
	return normalize(tx.Commit(ctx))
}

// SetHandle changes a handle, reporting a conflict when it is taken.
func (s *Store) SetHandle(ctx context.Context, userID, handle string) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET handle = $2 WHERE id = $1`, userID, handle)
	if err != nil && isUniqueViolationOn(err, "handle") {
		return ErrConflict
	}
	return normalize(err)
}

// UpsertSocialLink stores an unverified link. Verification is a separate flow;
// a link is shown as unverified until proof of control is completed.
func (s *Store) UpsertSocialLink(ctx context.Context, userID, platform, username, url string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO social_links (user_id, platform, username, url)
		VALUES ($1, $2::social_platform, $3, $4)
		ON CONFLICT (user_id, platform)
		DO UPDATE SET username = EXCLUDED.username, url = EXCLUDED.url, verified_at = NULL`,
		userID, platform, username, url)
	return normalize(err)
}

func (s *Store) DeleteSocialLink(ctx context.Context, userID, platform string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM social_links WHERE user_id = $1 AND platform = $2::social_platform`,
		userID, platform)
	return normalize(err)
}

func (s *Store) Wallets(ctx context.Context, userID string) ([]domain.Wallet, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT address, is_primary, created_at FROM wallets WHERE user_id = $1 ORDER BY is_primary DESC, created_at`,
		userID)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Wallet{}
	for rows.Next() {
		var w domain.Wallet
		if err := rows.Scan(&w.Address, &w.IsPrimary, &w.AddedAt); err != nil {
			return nil, normalize(err)
		}
		out = append(out, w)
	}
	return out, normalize(rows.Err())
}

// Follow creates a follow edge and increments the cached counter atomically.
func (s *Store) Follow(ctx context.Context, followerID, followingID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, followerID, followingID)
		if err != nil {
			return normalize(err)
		}
		if tag.RowsAffected() == 0 {
			return nil // already following; the counter is already correct
		}
		_, err = tx.Exec(ctx,
			`UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = $1`, followingID)
		return normalize(err)
	})
}

func (s *Store) Unfollow(ctx context.Context, followerID, followingID string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
			followerID, followingID)
		if err != nil {
			return normalize(err)
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		_, err = tx.Exec(ctx, `
			UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0)
			WHERE user_id = $1`, followingID)
		return normalize(err)
	})
}

func (s *Store) IsFollowing(ctx context.Context, followerID, followingID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)`,
		followerID, followingID).Scan(&exists)
	return exists, normalize(err)
}

// TalentQuery filters the hire directory.
type TalentQuery struct {
	Skills []string
	Search string
	Limit  int
	Offset int
}

// SearchTalent returns creators open to work, strongest signal first.
func (s *Store) SearchTalent(ctx context.Context, q TalentQuery) ([]domain.PublicUser, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id::text, u.handle::text, u.display_name, u.created_at,
		       COALESCE(p.headline,''), COALESCE(p.avatar_url,''), p.skills,
		       p.hourly_rate_usd, p.follower_count, p.video_count, p.sponsor_total_lamports
		FROM users u
		JOIN profiles p ON p.user_id = u.id
		WHERE u.status = 'active'
		  AND p.open_to_work
		  AND (cardinality($1::text[]) = 0 OR p.skills && $1::text[])
		  AND ($2 = '' OR u.display_name ILIKE '%' || $2 || '%' OR u.handle::text ILIKE '%' || $2 || '%')
		ORDER BY p.sponsor_total_lamports DESC, p.video_count DESC
		LIMIT $3 OFFSET $4`,
		q.Skills, q.Search, q.Limit, q.Offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.PublicUser{}
	for rows.Next() {
		var u domain.PublicUser
		if err := rows.Scan(&u.ID, &u.Handle, &u.DisplayName, &u.JoinedAt,
			&u.Headline, &u.AvatarURL, &u.Skills, &u.HourlyRate,
			&u.FollowerCount, &u.VideoCount, &u.SponsorTotal); err != nil {
			return nil, normalize(err)
		}
		u.OpenToWork = true
		u.SocialLinks = []domain.SocialLink{}
		out = append(out, u)
	}
	return out, normalize(rows.Err())
}
