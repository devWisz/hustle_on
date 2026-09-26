package server

import "net/http"

// routes registers every endpoint.
//
// The list is the API's access-control map, so it is written to be read that
// way: public routes first, then routes that need a session, then the two that
// need the admin role. Anything not listed here does not exist.
func (s *Server) routes() {
	m := s.mux

	// --- operational -----------------------------------------------------
	m.HandleFunc("GET /health", s.wrap(s.handleHealth))
	m.HandleFunc("GET /health/ready", s.wrap(s.handleReady))

	// --- public reads ----------------------------------------------------
	m.HandleFunc("GET /v1/timelapses", s.wrap(s.handleFeed))
	m.HandleFunc("GET /v1/timelapses/{slug}", s.wrap(s.handleTimelapse))
	m.HandleFunc("GET /v1/timelapses/{slug}/donations", s.wrap(s.handleTimelapseDonations))
	m.HandleFunc("GET /v1/timelapses/{slug}/notes", s.wrap(s.handleTimelapseNotes))
	m.HandleFunc("POST /v1/timelapses/{slug}/views", s.wrap(s.handleRecordView))
	m.HandleFunc("GET /v1/creators/{handle}", s.wrap(s.handleCreator))
	m.HandleFunc("GET /v1/creators/{handle}/timelapses", s.wrap(s.handleCreatorTimelapses))
	m.HandleFunc("GET /v1/stats", s.wrap(s.handleStats))

	// --- authentication --------------------------------------------------
	m.HandleFunc("POST /v1/auth/request-link", s.wrap(s.handleRequestLink))
	m.HandleFunc("POST /v1/auth/verify", s.wrap(s.handleVerifyLink))
	m.HandleFunc("POST /v1/auth/logout", s.wrap(s.handleLogout))
	m.HandleFunc("GET /v1/auth/session", s.wrap(s.handleSession))

	// --- the signed-in account -------------------------------------------
	m.HandleFunc("GET /v1/me", s.wrap(s.handleMe))
	m.HandleFunc("PATCH /v1/me", s.wrap(s.handleUpdateMe))
	m.HandleFunc("GET /v1/me/timelapses", s.wrap(s.handleMyTimelapses))
	m.HandleFunc("GET /v1/me/donations", s.wrap(s.handleMyDonations))
	m.HandleFunc("POST /v1/me/wallet/challenge", s.wrap(s.handleWalletChallenge))
	m.HandleFunc("POST /v1/me/wallet/verify", s.wrap(s.handleWalletVerify))
	m.HandleFunc("GET /v1/me/bookmarks", s.wrap(s.handleMyBookmarks))
	m.HandleFunc("PUT /v1/me/bookmarks/{slug}", s.wrap(s.handleAddBookmark))
	m.HandleFunc("DELETE /v1/me/bookmarks/{slug}", s.wrap(s.handleRemoveBookmark))

	// --- peer notes ------------------------------------------------------
	// Reading is public (registered above with the other public reads); these
	// three require an account, because each one records who said it.
	m.HandleFunc("POST /v1/timelapses/{slug}/notes", s.wrap(s.handleCreateNote))
	m.HandleFunc("POST /v1/timelapses/{slug}/notes/{noteId}/vote", s.wrap(s.handleVoteNote))
	m.HandleFunc("DELETE /v1/timelapses/{slug}/notes/{noteId}", s.wrap(s.handleDeleteNote))

	// --- publishing ------------------------------------------------------
	m.HandleFunc("POST /v1/uploads", s.wrap(s.handleCreateUpload))
	m.HandleFunc("POST /v1/timelapses", s.wrap(s.handleCreateTimelapse))
	m.HandleFunc("POST /v1/timelapses/{id}/uploaded", s.wrap(s.handleMarkUploaded))
	m.HandleFunc("POST /v1/timelapses/{id}/submit", s.wrap(s.handleSubmitTimelapse))
	m.HandleFunc("PATCH /v1/timelapses/{id}", s.wrap(s.handleUpdateTimelapse))
	m.HandleFunc("DELETE /v1/timelapses/{id}", s.wrap(s.handleDeleteTimelapse))

	// --- donations -------------------------------------------------------
	m.HandleFunc("POST /v1/donations", s.wrap(s.handleCreateDonation))
	m.HandleFunc("POST /v1/donations/{id}/confirm", s.wrap(s.handleConfirmDonation))

	// --- review (admin only) ---------------------------------------------
	m.HandleFunc("GET /v1/admin/queue", s.wrap(s.handleReviewQueue))
	m.HandleFunc("GET /v1/admin/audit", s.wrap(s.handleAuditLog))
	m.HandleFunc("POST /v1/admin/timelapses/{id}/approve", s.wrap(s.handleApprove))
	m.HandleFunc("POST /v1/admin/timelapses/{id}/reject", s.wrap(s.handleReject))
	m.HandleFunc("DELETE /v1/admin/timelapses/{id}", s.wrap(s.handleTakeDown))
	m.HandleFunc("GET /v1/admin/members", s.wrap(s.handleMembers))
	m.HandleFunc("POST /v1/admin/members/{id}/suspend", s.wrap(s.handleMemberStatus("suspended")))
	m.HandleFunc("POST /v1/admin/members/{id}/reinstate", s.wrap(s.handleMemberStatus("active")))
	m.HandleFunc("GET /v1/admin/ledger", s.wrap(s.handleLedger))
	m.HandleFunc("GET /v1/admin/activity", s.wrap(s.handleActivity))

	// --- local object storage (development only) -------------------------
	// Registered only when no real bucket is configured, so a production
	// deployment does not carry an unauthenticated write endpoint at all.
	if s.media.IsLocal() {
		m.HandleFunc("PUT /v1/uploads/local/{key...}", s.wrap(s.handleLocalUpload))
		m.HandleFunc("GET /v1/uploads/local/{key...}", s.wrap(s.handleServeLocalUpload))
	}

	// Anything unmatched gets a JSON 404 rather than the default text page.
	m.HandleFunc("/", s.wrap(s.handleNotFound))
}

func (s *Server) handleNotFound(w http.ResponseWriter, r *http.Request) error {
	return writeJSON(w, http.StatusNotFound, map[string]any{
		"error": map[string]string{"code": "not_found", "message": "No such endpoint."},
	})
}
