package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

func (s *Server) handleCreator(w http.ResponseWriter, r *http.Request) error {
	handle := strings.ToLower(r.PathValue("handle"))
	profile, err := s.store.ProfileByHandle(r.Context(), handle)
	if err != nil {
		return storeErr(err, "Creator")
	}

	// A signed-in visitor also learns whether they already follow this person,
	// so the button renders correctly on first paint.
	following := false
	if u, ok := currentUser(r); ok && u.ID != profile.ID {
		following, _ = s.store.IsFollowing(r.Context(), u.ID, profile.ID)
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"creator":     profile,
		"isFollowing": following,
	})
}

type updateProfileBody struct {
	DisplayName *string   `json:"displayName"`
	Headline    *string   `json:"headline"`
	Bio         *string   `json:"bio"`
	Location    *string   `json:"location"`
	AvatarURL   *string   `json:"avatarUrl"`
	BannerURL   *string   `json:"bannerUrl"`
	Skills      *[]string `json:"skills"`
	OpenToWork  *bool     `json:"openToWork"`
	HourlyRate  *float64  `json:"hourlyRateUsd"`
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body updateProfileBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New()
	clean := func(p *string, field string, min, max int) *string {
		if p == nil {
			return nil
		}
		c := validate.CleanText(*p)
		v.Length(field, c, min, max)
		return &c
	}
	up := store.ProfileUpdate{
		DisplayName: clean(body.DisplayName, "displayName", 1, 60),
		Headline:    clean(body.Headline, "headline", 0, 120),
		Bio:         clean(body.Bio, "bio", 0, 2000),
		Location:    clean(body.Location, "location", 0, 80),
		OpenToWork:  body.OpenToWork,
		HourlyRate:  body.HourlyRate,
	}
	if body.AvatarURL != nil {
		v.URL("avatarUrl", *body.AvatarURL)
		up.AvatarURL = body.AvatarURL
	}
	if body.BannerURL != nil {
		v.URL("bannerUrl", *body.BannerURL)
		up.BannerURL = body.BannerURL
	}
	if body.Skills != nil {
		skills := []string{}
		for _, sk := range *body.Skills {
			sk = strings.ToLower(strings.TrimSpace(sk))
			if validate.IsTag(sk) && len(skills) < 12 {
				skills = append(skills, sk)
			}
		}
		up.Skills = &skills
	}
	if body.HourlyRate != nil && (*body.HourlyRate < 0 || *body.HourlyRate > 100000) {
		v.Add("hourlyRateUsd", "Enter a rate between 0 and 100,000.")
	}
	if v.Any() {
		return v.Err()
	}

	if err := s.store.UpdateProfile(r.Context(), user.ID, up); err != nil {
		return storeErr(err, "Profile")
	}
	profile, err := s.store.ProfileByID(r.Context(), user.ID)
	if err != nil {
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, profile)
}

type socialLinkBody struct {
	Username string `json:"username"`
	URL      string `json:"url"`
}

// allowedSocialHosts pins each platform to its real domain, so a "GitHub" link
// on a profile cannot quietly point somewhere else.
var allowedSocialHosts = map[string][]string{
	"x":        {"x.com", "twitter.com"},
	"github":   {"github.com"},
	"youtube":  {"youtube.com", "www.youtube.com"},
	"linkedin": {"linkedin.com", "www.linkedin.com"},
	"website":  nil, // any https host
}

func (s *Server) handleSetSocialLink(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	platform := strings.ToLower(r.PathValue("platform"))
	hosts, known := allowedSocialHosts[platform]
	if !known {
		return apierr.NotFound("Platform")
	}
	var body socialLinkBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New().
		Required("username", body.Username).
		Length("username", body.Username, 1, 100).
		URL("url", body.URL)
	if v.Any() {
		return v.Err()
	}
	parsed, parseErr := url.Parse(body.URL)
	if parseErr != nil || parsed.Scheme != "https" {
		return apierr.Validation("Enter a full https:// address.").
			WithField("url", "Enter a full https:// address.")
	}
	if hosts != nil && !hostAllowed(parsed.Hostname(), hosts) {
		return apierr.Validation("That link does not point at "+platform+".").
			WithField("url", "Use a link on "+strings.Join(hosts, " or ")+".")
	}

	if err := s.store.UpsertSocialLink(r.Context(), user.ID, platform,
		strings.TrimSpace(body.Username), body.URL); err != nil {
		return storeErr(err, "Link")
	}
	links, err := s.store.SocialLinks(r.Context(), user.ID)
	if err != nil {
		return storeErr(err, "Links")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"socialLinks": links})
}

func hostAllowed(host string, allowed []string) bool {
	host = strings.ToLower(host)
	for _, a := range allowed {
		if host == a {
			return true
		}
	}
	return false
}

func (s *Server) handleDeleteSocialLink(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	platform := strings.ToLower(r.PathValue("platform"))
	if _, known := allowedSocialHosts[platform]; !known {
		return apierr.NotFound("Platform")
	}
	if err := s.store.DeleteSocialLink(r.Context(), user.ID, platform); err != nil {
		return storeErr(err, "Link")
	}
	return noContent(w)
}

func (s *Server) handleTalent(w http.ResponseWriter, r *http.Request) error {
	people, err := s.store.SearchTalent(r.Context(), store.TalentQuery{
		Skills: queryList(r, "skills", 8, validate.IsTag),
		Search: queryString(r, "q", 80),
		Limit:  queryInt(r, "limit", 24, 1, 50),
		Offset: queryInt(r, "offset", 0, 0, 5000),
	})
	if err != nil {
		return storeErr(err, "Talent")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.PublicUser]{Items: people})
}

func (s *Server) handleFollow(w http.ResponseWriter, r *http.Request) error {
	return s.setFollow(w, r, true)
}

func (s *Server) handleUnfollow(w http.ResponseWriter, r *http.Request) error {
	return s.setFollow(w, r, false)
}

func (s *Server) setFollow(w http.ResponseWriter, r *http.Request, follow bool) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	target, err := s.store.UserByHandle(r.Context(), strings.ToLower(r.PathValue("handle")))
	if err != nil {
		return storeErr(err, "Creator")
	}
	if target.ID == user.ID {
		return apierr.BadRequest("You cannot follow your own profile.")
	}

	if follow {
		err = s.store.Follow(r.Context(), user.ID, target.ID)
	} else {
		err = s.store.Unfollow(r.Context(), user.ID, target.ID)
	}
	if err != nil {
		return storeErr(err, "Creator")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"isFollowing": follow})
}

func (s *Server) handleNotifications(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	items, err := s.store.Notifications(r.Context(), user.ID, queryInt(r, "limit", 30, 1, 100))
	if err != nil {
		return storeErr(err, "Notifications")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Notification]{Items: items})
}

func (s *Server) handleReadNotifications(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	if err := s.store.MarkNotificationsRead(r.Context(), user.ID); err != nil {
		return storeErr(err, "Notifications")
	}
	return noContent(w)
}
