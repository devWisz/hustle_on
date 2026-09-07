package server

import (
	"net/http"
	"strings"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

func (s *Server) handleListJobs(w http.ResponseWriter, r *http.Request) error {
	var remote *bool
	switch r.URL.Query().Get("remote") {
	case "true":
		v := true
		remote = &v
	case "false":
		v := false
		remote = &v
	}

	jobs, err := s.store.Jobs(r.Context(), store.JobQuery{
		Skills: queryList(r, "skills", 8, validate.IsTag),
		Search: queryString(r, "q", 80),
		Remote: remote,
		Limit:  queryInt(r, "limit", 24, 1, 50),
		Offset: queryInt(r, "offset", 0, 0, 5000),
	})
	if err != nil {
		return storeErr(err, "Jobs")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Job]{Items: jobs})
}

func (s *Server) handleJob(w http.ResponseWriter, r *http.Request) error {
	viewerID := ""
	if u, ok := currentUser(r); ok {
		viewerID = u.ID
	}
	job, err := s.store.JobBySlug(r.Context(), r.PathValue("slug"), viewerID)
	if err != nil {
		return storeErr(err, "Role")
	}
	return writeJSON(w, http.StatusOK, job)
}

type createJobBody struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Skills      []string `json:"skills"`
	Engagement  string   `json:"engagement"`
	BudgetMin   *float64 `json:"budgetMinUsd"`
	BudgetMax   *float64 `json:"budgetMaxUsd"`
	IsRemote    bool     `json:"isRemote"`
	Location    string   `json:"location"`
	Publish     bool     `json:"publish"`
}

var validEngagements = map[string]bool{"fixed": true, "hourly": true, "milestone": true}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body createJobBody
	if err := decode(r, &body); err != nil {
		return err
	}

	title := validate.CleanText(body.Title)
	description := validate.CleanText(body.Description)
	v := validate.New().
		Required("title", title).
		Length("title", title, 3, 120).
		Required("description", description).
		Length("description", description, 20, 10000).
		Length("location", body.Location, 0, 80)
	if body.Engagement == "" {
		body.Engagement = "fixed"
	}
	if !validEngagements[body.Engagement] {
		v.Add("engagement", "Choose fixed, hourly or milestone.")
	}
	if body.BudgetMin != nil && body.BudgetMax != nil && *body.BudgetMax < *body.BudgetMin {
		v.Add("budgetMaxUsd", "Maximum must be at least the minimum.")
	}
	if v.Any() {
		return v.Err()
	}

	skills := []string{}
	for _, sk := range body.Skills {
		sk = strings.ToLower(strings.TrimSpace(sk))
		if validate.IsTag(sk) && len(skills) < 12 {
			skills = append(skills, sk)
		}
	}

	id, err := s.store.CreateJob(r.Context(), store.NewJob{
		ClientID:    user.ID,
		Slug:        newSlug(title),
		Title:       title,
		Description: description,
		Skills:      skills,
		Engagement:  body.Engagement,
		BudgetMin:   body.BudgetMin,
		BudgetMax:   body.BudgetMax,
		IsRemote:    body.IsRemote,
		Location:    validate.CleanText(body.Location),
		Publish:     body.Publish,
	})
	if err != nil {
		return storeErr(err, "Role")
	}
	return writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

type applyBody struct {
	CoverNote    string   `json:"coverNote"`
	PortfolioIDs []string `json:"portfolioVideoIds"`
	RateUSD      *float64 `json:"rateUsd"`
}

func (s *Server) handleApply(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body applyBody
	if err := decode(r, &body); err != nil {
		return err
	}

	job, err := s.store.JobBySlug(r.Context(), r.PathValue("slug"), "")
	if err != nil {
		return storeErr(err, "Role")
	}
	if job.Client.ID == user.ID {
		return apierr.BadRequest("You cannot apply to your own posting.")
	}

	note := validate.CleanText(body.CoverNote)
	v := validate.New().Length("coverNote", note, 0, 3000)
	ids := []string{}
	for _, id := range body.PortfolioIDs {
		if !validate.IsUUID(id) {
			v.Add("portfolioVideoIds", "One of those videos is not valid.")
			break
		}
		if len(ids) < 6 {
			ids = append(ids, id)
		}
	}
	if body.RateUSD != nil && (*body.RateUSD < 0 || *body.RateUSD > 1000000) {
		v.Add("rateUsd", "Enter a rate between 0 and 1,000,000.")
	}
	if v.Any() {
		return v.Err()
	}

	id, err := s.store.Apply(r.Context(), store.NewApplication{
		JobID:        job.ID,
		ApplicantID:  user.ID,
		CoverNote:    note,
		PortfolioIDs: ids,
		RateUSD:      body.RateUSD,
	})
	if err != nil {
		return storeErr(err, "Application")
	}
	return writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

// handleListApplications is restricted to the client who posted the role.
func (s *Server) handleListApplications(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	job, err := s.store.JobBySlug(r.Context(), r.PathValue("slug"), user.ID)
	if err != nil {
		return storeErr(err, "Role")
	}
	if job.Client.ID != user.ID {
		return apierr.Forbidden("Only the client who posted this role can see applications.")
	}

	apps, err := s.store.ApplicationsForJob(r.Context(), job.ID, user.ID,
		queryInt(r, "limit", 25, 1, 100), queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Applications")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Application]{Items: apps})
}

type applicationStatusBody struct {
	Status string `json:"status"`
}

var validApplicationStatus = map[string]bool{
	"shortlisted": true, "rejected": true, "accepted": true,
}

func (s *Server) handleSetApplicationStatus(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Application")
	}
	var body applicationStatusBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if !validApplicationStatus[body.Status] {
		return apierr.Validation("Choose shortlisted, rejected or accepted.").
			WithField("status", "Not a valid status.")
	}

	// Ownership is enforced inside the statement, so a guessed application id
	// belonging to someone else's posting simply matches no row.
	if err := s.store.SetApplicationStatus(r.Context(), id, user.ID, body.Status); err != nil {
		return storeErr(err, "Application")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"status": body.Status})
}
