package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

const jobSelect = `
	SELECT j.id::text, j.slug, j.title, j.description, j.skills, j.engagement::text,
	       j.budget_min_usd, j.budget_max_usd, j.is_remote, COALESCE(j.location,''),
	       j.status::text, j.application_count, j.published_at, j.closes_at, j.created_at,
	       u.id::text, u.handle::text, u.display_name, COALESCE(p.avatar_url,'')
	FROM jobs j
	JOIN users u ON u.id = j.client_id
	JOIN profiles p ON p.user_id = u.id`

func scanJob(row pgx.Row) (domain.Job, error) {
	var j domain.Job
	err := row.Scan(&j.ID, &j.Slug, &j.Title, &j.Description, &j.Skills, &j.Engagement,
		&j.BudgetMin, &j.BudgetMax, &j.IsRemote, &j.Location, &j.Status,
		&j.Applications, &j.PublishedAt, &j.ClosesAt, &j.CreatedAt,
		&j.Client.ID, &j.Client.Handle, &j.Client.DisplayName, &j.Client.AvatarURL)
	return j, err
}

// NewJob is the input for posting a role.
type NewJob struct {
	ClientID    string
	Slug        string
	Title       string
	Description string
	Skills      []string
	Engagement  string
	BudgetMin   *float64
	BudgetMax   *float64
	IsRemote    bool
	Location    string
	Publish     bool
}

func (s *Store) CreateJob(ctx context.Context, in NewJob) (string, error) {
	status := "draft"
	if in.Publish {
		status = "open"
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO jobs (client_id, slug, title, description, skills, engagement,
		                  budget_min_usd, budget_max_usd, is_remote, location, status, published_at)
		VALUES ($1, $2, $3, $4, $5, $6::engagement_type, $7, $8, $9, $10,
		        $11::job_status, CASE WHEN $11 = 'open' THEN now() END)
		RETURNING id::text`,
		in.ClientID, in.Slug, in.Title, in.Description, in.Skills, in.Engagement,
		in.BudgetMin, in.BudgetMax, in.IsRemote, nullText(in.Location), status).Scan(&id)
	return id, normalize(err)
}

// JobQuery filters the public job board.
type JobQuery struct {
	Skills []string
	Search string
	Remote *bool
	Limit  int
	Offset int
}

func (s *Store) Jobs(ctx context.Context, q JobQuery) ([]domain.Job, error) {
	rows, err := s.pool.Query(ctx, jobSelect+`
		WHERE j.status = 'open'
		  AND u.status = 'active'
		  AND (j.closes_at IS NULL OR j.closes_at > now())
		  AND (cardinality($1::text[]) = 0 OR j.skills && $1::text[])
		  AND ($2 = '' OR j.title ILIKE '%' || $2 || '%')
		  AND ($3::boolean IS NULL OR j.is_remote = $3)
		ORDER BY j.published_at DESC
		LIMIT $4 OFFSET $5`, q.Skills, q.Search, q.Remote, q.Limit, q.Offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, normalize(err)
		}
		out = append(out, j)
	}
	return out, normalize(rows.Err())
}

func (s *Store) JobBySlug(ctx context.Context, slug, viewerID string) (domain.Job, error) {
	j, err := scanJob(s.pool.QueryRow(ctx, jobSelect+`
		WHERE j.slug = $1 AND (j.status = 'open' OR ($2 <> '' AND j.client_id = $2::uuid))`,
		slug, viewerID))
	if err != nil {
		return domain.Job{}, normalize(err)
	}
	return j, nil
}

// NewApplication is a candidate applying to a role.
type NewApplication struct {
	JobID        string
	ApplicantID  string
	CoverNote    string
	PortfolioIDs []string
	RateUSD      *float64
}

// Apply records an application. The portfolio videos are checked to belong to
// the applicant, so a candidate cannot present someone else's work as theirs.
func (s *Store) Apply(ctx context.Context, in NewApplication) (string, error) {
	var id string
	err := s.tx(ctx, func(tx pgx.Tx) error {
		if len(in.PortfolioIDs) > 0 {
			var owned int
			if err := tx.QueryRow(ctx, `
				SELECT count(*) FROM videos
				WHERE id = ANY($1::uuid[]) AND user_id = $2 AND status = 'published'`,
				in.PortfolioIDs, in.ApplicantID).Scan(&owned); err != nil {
				return normalize(err)
			}
			if owned != len(in.PortfolioIDs) {
				return ErrNotFound
			}
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO job_applications (job_id, applicant_id, cover_note, portfolio_video_ids, rate_usd)
			VALUES ($1, $2, $3, $4::uuid[], $5)
			RETURNING id::text`,
			in.JobID, in.ApplicantID, nullText(in.CoverNote), in.PortfolioIDs, in.RateUSD).Scan(&id); err != nil {
			return normalize(err)
		}
		_, err := tx.Exec(ctx,
			`UPDATE jobs SET application_count = application_count + 1 WHERE id = $1`, in.JobID)
		return normalize(err)
	})
	return id, err
}

// ApplicationsForJob is restricted to the client who owns the posting.
func (s *Store) ApplicationsForJob(ctx context.Context, jobID, clientID string, limit, offset int) ([]domain.Application, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.id::text, a.job_id::text, COALESCE(a.cover_note,''), a.portfolio_video_ids,
		       a.rate_usd, a.status::text, a.created_at,
		       u.id::text, u.handle::text, u.display_name, COALESCE(p.avatar_url,'')
		FROM job_applications a
		JOIN jobs j ON j.id = a.job_id AND j.client_id = $2
		JOIN users u ON u.id = a.applicant_id
		JOIN profiles p ON p.user_id = u.id
		WHERE a.job_id = $1
		ORDER BY a.created_at DESC
		LIMIT $3 OFFSET $4`, jobID, clientID, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Application{}
	for rows.Next() {
		var a domain.Application
		var ids []string
		if err := rows.Scan(&a.ID, &a.JobID, &a.CoverNote, &ids, &a.RateUSD,
			&a.Status, &a.CreatedAt,
			&a.Applicant.ID, &a.Applicant.Handle, &a.Applicant.DisplayName, &a.Applicant.AvatarURL); err != nil {
			return nil, normalize(err)
		}
		a.PortfolioIDs = ids
		out = append(out, a)
	}
	return out, normalize(rows.Err())
}

// SetApplicationStatus is authorised against the job's owner in the statement
// itself, so a forged application id cannot be moved by a stranger.
func (s *Store) SetApplicationStatus(ctx context.Context, applicationID, clientID, status string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var applicantID string
		err := tx.QueryRow(ctx, `
			UPDATE job_applications a SET status = $3::application_status
			FROM jobs j
			WHERE a.id = $1 AND a.job_id = j.id AND j.client_id = $2
			RETURNING a.applicant_id::text`, applicationID, clientID, status).Scan(&applicantID)
		if err != nil {
			return normalize(err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO notifications (user_id, kind, payload)
			VALUES ($1, 'application_update', jsonb_build_object('applicationId', $2::text, 'status', $3::text))`,
			applicantID, applicationID, status)
		return normalize(err)
	})
}

func (s *Store) JobOwner(ctx context.Context, jobID string) (string, error) {
	var owner string
	err := s.pool.QueryRow(ctx, `SELECT client_id::text FROM jobs WHERE id = $1`, jobID).Scan(&owner)
	return owner, normalize(err)
}
