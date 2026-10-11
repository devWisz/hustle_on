package server

import "net/http"

// routes registers every endpoint.
//
// The list is the API's access-control map, so it is written to be read that
// way: public routes first, then routes that need a session, then the two that
// need the admin role. Anything not listed here does not exist.
//
// The second argument of every entry is the rate limit budget the route is
// charged against (see budgets.go). It is a required argument rather than a
// defaulted one on purpose: adding an endpoint means deciding what it may cost,
// and a route cannot be added without a budget by accident. Authentication and
// authorisation are checked by the handler itself, since only it knows whether
// the caller must be a member or an admin.
func (s *Server) routes() {
	// --- operational -----------------------------------------------------
	s.route("GET /health", budgetRead, s.handleHealth)
	s.route("GET /health/ready", budgetRead, s.handleReady)

	// --- public reads ----------------------------------------------------
	s.route("GET /v1/timelapses", budgetRead, s.handleFeed)
	s.route("GET /v1/timelapses/{slug}", budgetRead, s.handleTimelapse)
	s.route("GET /v1/timelapses/{slug}/donations", budgetRead, s.handleTimelapseDonations)
	s.route("GET /v1/timelapses/{slug}/notes", budgetRead, s.handleTimelapseNotes)
	s.route("POST /v1/timelapses/{slug}/views", budgetEngage, s.handleRecordView)
	s.route("GET /v1/creators/{handle}", budgetRead, s.handleCreator)
	s.route("GET /v1/creators/{handle}/timelapses", budgetRead, s.handleCreatorTimelapses)
	s.route("GET /v1/stats", budgetRead, s.handleStats)
	s.route("GET /v1/featured", budgetRead, s.handleFeatured)
	s.route("POST /v1/reports", budgetEngage, s.handleCreateReport)

	// --- authentication --------------------------------------------------
	// Sign-in gets its own tight budgets, charged by address rather than by
	// account: these two hand out nonces and consume them, and they are the only
	// endpoints where guessing is a useful attack. The two are budgeted
	// separately so that asking for challenges cannot exhaust the allowance for
	// spending them, which would let one caller lock everybody else out of
	// signing in simply by asking repeatedly.
	s.route("POST /v1/auth/signin/challenge", budgetAuth, s.handleSignInChallenge)
	s.route("POST /v1/auth/signin/verify", budgetVerify, s.handleSignInVerify)
	// Password sign-up and sign-in. Sign-up gets the tight "auth" budget because
	// each request writes an account and does an expensive hash; sign-in gets the
	// tighter "verify" budget, because it is the one endpoint where guessing is
	// the whole attack.
	s.route("POST /v1/auth/signup", budgetAuth, s.handleSignUp)
	s.route("POST /v1/auth/login", budgetVerify, s.handleLogIn)
	s.route("POST /v1/auth/logout", budgetEngage, s.handleLogout)
	s.route("POST /v1/auth/logout-all", budgetEngage, s.handleLogoutAll)
	s.route("GET /v1/auth/session", budgetRead, s.handleSession)

	// --- the signed-in account -------------------------------------------
	s.route("GET /v1/me", budgetRead, s.handleMe)
	s.route("PATCH /v1/me", budgetWrite, s.handleUpdateMe)
	s.route("POST /v1/me/password", budgetWrite, s.handleChangePassword)
	s.route("GET /v1/me/timelapses", budgetRead, s.handleMyTimelapses)
	s.route("GET /v1/me/donations", budgetRead, s.handleMyDonations)
	s.route("POST /v1/me/wallet/challenge", budgetEngage, s.handleWalletChallenge)
	s.route("POST /v1/me/wallet/verify", budgetEngage, s.handleWalletVerify)
	// The profile step a new account is asked to complete once, and the picture
	// it can change afterwards.
	s.route("POST /v1/me/onboarding", budgetWrite, s.handleCompleteOnboarding)
	s.route("POST /v1/uploads/avatar", budgetPoster, s.handleAvatarUpload)
	s.route("PUT /v1/me/avatar", budgetWrite, s.handleSetAvatar)
	s.route("DELETE /v1/me/avatar", budgetWrite, s.handleClearAvatar)
	s.route("GET /v1/me/bookmarks", budgetRead, s.handleMyBookmarks)
	s.route("PUT /v1/me/bookmarks/{slug}", budgetEngage, s.handleAddBookmark)
	s.route("DELETE /v1/me/bookmarks/{slug}", budgetEngage, s.handleRemoveBookmark)

	// --- peer notes ------------------------------------------------------
	// Reading is public (registered above with the other public reads); these
	// three require an account, because each one records who said it.
	s.route("POST /v1/timelapses/{slug}/notes", budgetEngage, s.handleCreateNote)
	s.route("POST /v1/timelapses/{slug}/notes/{noteId}/vote", budgetEngage, s.handleVoteNote)
	s.route("DELETE /v1/timelapses/{slug}/notes/{noteId}", budgetEngage, s.handleDeleteNote)

	// --- publishing ------------------------------------------------------
	// Issuing an upload URL is the most expensive thing a member can ask for,
	// so it is budgeted apart from the metadata writes that follow it.
	s.route("POST /v1/uploads", budgetUpload, s.handleCreateUpload)
	s.route("POST /v1/timelapses", budgetWrite, s.handleCreateTimelapse)
	s.route("POST /v1/timelapses/{id}/uploaded", budgetWrite, s.handleMarkUploaded)
	s.route("POST /v1/timelapses/{id}/submit", budgetWrite, s.handleSubmitTimelapse)
	s.route("PATCH /v1/timelapses/{id}", budgetWrite, s.handleUpdateTimelapse)
	s.route("DELETE /v1/timelapses/{id}", budgetWrite, s.handleDeleteTimelapse)

	// --- donations -------------------------------------------------------
	s.route("POST /v1/donations", budgetDonate, s.handleCreateDonation)
	// Confirming is budgeted apart from creating: it is polled, so it needs an
	// allowance a poll can live inside, while creating the intent stays tight.
	s.route("POST /v1/donations/{id}/confirm", budgetDonateCheck, s.handleConfirmDonation)

	// --- the operator's editing desk (admin only) -------------------------
	// These change what the public sees without changing a status, so they are
	// budgeted with the console and audited like every other decision.
	s.route("GET /v1/admin/featured", budgetAdmin, s.handleAdminFeatured)
	s.route("PUT /v1/admin/featured", budgetAdmin, s.handleAdminReorderFeatured)
	s.route("PATCH /v1/admin/timelapses/{id}", budgetAdmin, s.handleAdminEditTimelapse)
	s.route("PUT /v1/admin/timelapses/{id}/thumbnail", budgetAdmin, s.handleAdminSetThumbnail)
	s.route("DELETE /v1/admin/timelapses/{id}/thumbnail", budgetAdmin, s.handleAdminClearThumbnail)
	// A poster goes to storage like a video does, but it is small and only an
	// operator can ask for one, so it has an allowance of its own rather than
	// sharing the tight video budget.
	s.route("POST /v1/admin/uploads/thumbnail", budgetPoster, s.handleAdminPosterUpload)

	// --- review (admin only) ---------------------------------------------
	s.route("GET /v1/admin/queue", budgetAdmin, s.handleReviewQueue)
	s.route("GET /v1/admin/audit", budgetAdmin, s.handleAuditLog)
	s.route("POST /v1/admin/timelapses/{id}/approve", budgetAdmin, s.handleApprove)
	s.route("POST /v1/admin/timelapses/{id}/reject", budgetAdmin, s.handleReject)
	s.route("DELETE /v1/admin/timelapses/{id}", budgetAdmin, s.handleTakeDown)
	s.route("GET /v1/admin/members", budgetAdmin, s.handleMembers)
	s.route("POST /v1/admin/members/{id}/suspend", budgetAdmin, s.handleMemberStatus("suspended"))
	s.route("POST /v1/admin/members/{id}/reinstate", budgetAdmin, s.handleMemberStatus("active"))
	s.route("GET /v1/admin/ledger", budgetAdmin, s.handleLedger)
	// The money side: which cluster we read, whether the node is answering, and a
	// way to re-check one sponsorship while the donor is still waiting.
	s.route("GET /v1/admin/chain", budgetAdmin, s.handleAdminChainStatus)
	s.route("POST /v1/admin/donations/{id}/recheck", budgetAdmin, s.handleAdminRecheckDonation)
	s.route("GET /v1/admin/activity", budgetAdmin, s.handleActivity)
	s.route("GET /v1/admin/notes", budgetAdmin, s.handleAdminNotes)
	s.route("GET /v1/admin/reports", budgetAdmin, s.handleAdminReports)
	s.route("POST /v1/admin/reports/{id}/resolve", budgetAdmin, s.handleResolveReport)
	s.route("POST /v1/admin/timelapses/{id}/feature", budgetAdmin, s.handleFeature(true))
	s.route("DELETE /v1/admin/timelapses/{id}/feature", budgetAdmin, s.handleFeature(false))

	// --- local object storage (development only) -------------------------
	// Registered only when no real bucket is configured, so a production
	// deployment does not carry an unauthenticated write endpoint at all.
	// Reading is cheap; writing a megabyte at a time is not.
	if s.media.IsLocal() {
		s.route("PUT /v1/uploads/local/{key...}", budgetUpload, s.handleLocalUpload)
		s.route("GET /v1/uploads/local/{key...}", budgetRead, s.handleServeLocalUpload)
	}

	// Anything unmatched gets a JSON 404 rather than the default text page.
	s.route("/", budgetRead, s.handleNotFound)
}

func (s *Server) handleNotFound(w http.ResponseWriter, r *http.Request) error {
	return writeJSON(w, http.StatusNotFound, map[string]any{
		"error": map[string]string{"code": "not_found", "message": "No such endpoint."},
	})
}
