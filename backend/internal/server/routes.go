package server

import "net/http"

// routes registers every endpoint.
//
// The list is the API's access-control map, so it is written to be read that
// way: public routes first, then routes that require a session, then routes
// that require a role. Anything not listed here does not exist.
func (s *Server) routes() {
	m := s.mux

	// --- operational ---------------------------------------------------
	m.HandleFunc("GET /health", s.wrap(s.handleHealth))
	m.HandleFunc("GET /healthz", s.wrap(s.handleHealth))
	m.HandleFunc("GET /health/ready", s.wrap(s.handleReady))

	// --- local upload & streaming (dev) --------------------------------
	m.HandleFunc("PUT /v1/uploads/local/{key...}", s.wrap(s.handleLocalUpload))
	m.HandleFunc("GET /v1/uploads/local/{key...}", s.wrap(s.handleServeLocalUpload))

	// --- public reads --------------------------------------------------
	m.HandleFunc("GET /v1/feed", s.wrap(s.handleFeed))
	m.HandleFunc("GET /v1/videos/{slug}", s.wrap(s.handleVideo))
	m.HandleFunc("GET /v1/videos/{slug}/comments", s.wrap(s.handleListComments))
	m.HandleFunc("GET /v1/videos/{slug}/sponsors", s.wrap(s.handleVideoSponsors))
	m.HandleFunc("GET /v1/creators/{handle}", s.wrap(s.handleCreator))
	m.HandleFunc("GET /v1/creators/{handle}/videos", s.wrap(s.handleCreatorVideos))
	m.HandleFunc("GET /v1/talent", s.wrap(s.handleTalent))
	m.HandleFunc("GET /v1/jobs", s.wrap(s.handleListJobs))
	m.HandleFunc("GET /v1/jobs/{slug}", s.wrap(s.handleJob))
	m.HandleFunc("GET /v1/stats", s.wrap(s.handlePublicStats))
	m.HandleFunc("POST /v1/videos/{slug}/views", s.wrap(s.handleRecordView))

	// --- authentication ------------------------------------------------
	m.HandleFunc("POST /v1/auth/request-link", s.wrap(s.handleRequestLink))
	m.HandleFunc("POST /v1/auth/verify", s.wrap(s.handleVerifyLink))
	m.HandleFunc("POST /v1/auth/logout", s.wrap(s.handleLogout))
	m.HandleFunc("GET /v1/auth/session", s.wrap(s.handleSession))
	m.HandleFunc("POST /v1/auth/wallet/challenge", s.wrap(s.handleWalletChallenge))
	m.HandleFunc("POST /v1/auth/wallet/verify", s.wrap(s.handleWalletVerify))

	// --- the signed-in user --------------------------------------------
	m.HandleFunc("GET /v1/me", s.wrap(s.handleMe))
	m.HandleFunc("PATCH /v1/me", s.wrap(s.handleUpdateMe))
	m.HandleFunc("PUT /v1/me/handle", s.wrap(s.handleSetHandle))
	m.HandleFunc("PUT /v1/me/social/{platform}", s.wrap(s.handleSetSocialLink))
	m.HandleFunc("DELETE /v1/me/social/{platform}", s.wrap(s.handleDeleteSocialLink))
	m.HandleFunc("GET /v1/me/wallets", s.wrap(s.handleMyWallets))
	m.HandleFunc("GET /v1/me/sponsorships", s.wrap(s.handleMySponsorships))
	m.HandleFunc("GET /v1/me/notifications", s.wrap(s.handleNotifications))
	m.HandleFunc("POST /v1/me/notifications/read", s.wrap(s.handleReadNotifications))

	// --- publishing ------------------------------------------------------
	m.HandleFunc("POST /v1/uploads", s.wrap(s.handleCreateUpload))
	m.HandleFunc("POST /v1/videos", s.wrap(s.handleCreateVideo))
	m.HandleFunc("POST /v1/videos/{id}/uploaded", s.wrap(s.handleMarkUploaded))
	m.HandleFunc("POST /v1/videos/{id}/publish", s.wrap(s.handlePublishVideo))
	m.HandleFunc("PATCH /v1/videos/{id}", s.wrap(s.handleUpdateVideo))
	m.HandleFunc("DELETE /v1/videos/{id}", s.wrap(s.handleDeleteVideo))

	// --- discussion ------------------------------------------------------
	m.HandleFunc("POST /v1/videos/{slug}/comments", s.wrap(s.handleAddComment))
	m.HandleFunc("DELETE /v1/comments/{id}", s.wrap(s.handleDeleteComment))
	m.HandleFunc("POST /v1/comments/{id}/like", s.wrap(s.handleLikeComment))
	m.HandleFunc("DELETE /v1/comments/{id}/like", s.wrap(s.handleUnlikeComment))

	// --- sponsorship -----------------------------------------------------
	m.HandleFunc("POST /v1/sponsorships", s.wrap(s.handleCreateSponsorship))
	m.HandleFunc("POST /v1/sponsorships/{id}/signature", s.wrap(s.handleAttachSignature))
	m.HandleFunc("POST /v1/sponsorships/{id}/confirm", s.wrap(s.handleConfirmSponsorship))

	// --- following -------------------------------------------------------
	m.HandleFunc("POST /v1/creators/{handle}/follow", s.wrap(s.handleFollow))
	m.HandleFunc("DELETE /v1/creators/{handle}/follow", s.wrap(s.handleUnfollow))

	// --- hiring ----------------------------------------------------------
	m.HandleFunc("POST /v1/jobs", s.wrap(s.handleCreateJob))
	m.HandleFunc("POST /v1/jobs/{slug}/applications", s.wrap(s.handleApply))
	m.HandleFunc("GET /v1/jobs/{slug}/applications", s.wrap(s.handleListApplications))
	m.HandleFunc("POST /v1/applications/{id}/status", s.wrap(s.handleSetApplicationStatus))

	// --- trust and safety ------------------------------------------------
	m.HandleFunc("POST /v1/reports", s.wrap(s.handleReport))

	// --- admin console (moderator or admin only) -------------------------
	m.HandleFunc("GET /v1/admin/stats", s.wrap(s.handleAdminStats))
	m.HandleFunc("GET /v1/admin/health", s.wrap(s.handleAdminHealth))
	m.HandleFunc("GET /v1/admin/users", s.wrap(s.handleAdminUsers))
	m.HandleFunc("GET /v1/admin/videos", s.wrap(s.handleAdminVideos))
	m.HandleFunc("GET /v1/admin/jobs", s.wrap(s.handleAdminJobs))
	m.HandleFunc("GET /v1/admin/reports", s.wrap(s.handleAdminReports))
	m.HandleFunc("POST /v1/admin/reports/{id}/resolve", s.wrap(s.handleResolveReport))

	// Anything unmatched gets a JSON 404 rather than the default text page.
	m.HandleFunc("/", s.wrap(s.handleNotFound))
}

func (s *Server) handleNotFound(w http.ResponseWriter, r *http.Request) error {
	return writeJSON(w, http.StatusNotFound, map[string]any{
		"error": map[string]string{"code": "not_found", "message": "No such endpoint."},
	})
}
