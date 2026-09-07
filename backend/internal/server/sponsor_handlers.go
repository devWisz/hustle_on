package server

import (
	"errors"
	"net/http"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

type createSponsorshipBody struct {
	CreatorHandle string `json:"creatorHandle"`
	VideoID       string `json:"videoId"`
	Amount        int64  `json:"amount"` // lamports
	Message       string `json:"message"`
	IsAnonymous   bool   `json:"isAnonymous"`
}

// handleCreateSponsorship records the intent and returns the destination the
// client must pay. The payee comes from our database, never from the request:
// if the client could choose it, a tampered page could redirect a sponsorship
// to an attacker's wallet while still showing the creator's name.
func (s *Server) handleCreateSponsorship(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body createSponsorshipBody
	if err := decode(r, &body); err != nil {
		return err
	}

	message := validate.CleanText(body.Message)
	v := validate.New().
		Required("creatorHandle", body.CreatorHandle).
		PositiveAmount("amount", body.Amount).
		Length("message", message, 0, 280)
	if body.VideoID != "" {
		v.UUID("videoId", body.VideoID)
	}
	if v.Any() {
		return v.Err()
	}

	creator, err := s.store.UserByHandle(r.Context(), body.CreatorHandle)
	if err != nil {
		return storeErr(err, "Creator")
	}
	if creator.ID == user.ID {
		return apierr.BadRequest("You cannot sponsor yourself.")
	}

	payee, err := s.store.CreatorPayoutAddress(r.Context(), creator.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("This creator has not connected a wallet yet.")
		}
		return storeErr(err, "Creator")
	}

	id, err := s.store.CreateSponsorshipIntent(r.Context(), store.NewSponsorship{
		SponsorID:   user.ID,
		CreatorID:   creator.ID,
		VideoID:     body.VideoID,
		Amount:      body.Amount,
		Message:     message,
		IsAnonymous: body.IsAnonymous,
	})
	if err != nil {
		return storeErr(err, "Sponsorship")
	}

	return writeJSON(w, http.StatusCreated, map[string]any{
		"sponsorshipId": id,
		"payTo":         payee,
		"amount":        body.Amount,
		"cluster":       s.chain.Cluster(),
		"programId":     s.cfg.SolanaProgramID,
		"treasury":      s.cfg.Treasury,
		"feeBps":        s.cfg.PlatformFeeBPS,
	})
}

type signatureBody struct {
	Signature string `json:"signature"`
	Payer     string `json:"payer"`
}

// handleAttachSignature records the signature the wallet returned.
func (s *Server) handleAttachSignature(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Sponsorship")
	}
	var body signatureBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if len(body.Signature) < 64 || len(body.Signature) > 100 {
		return apierr.Validation("That transaction signature is not valid.").
			WithField("signature", "Expected a base58 transaction signature.")
	}
	if err := auth.ValidateSolanaAddress(body.Payer); err != nil {
		return apierr.Validation("That payer address is not valid.").
			WithField("payer", "Enter a valid Solana address.")
	}

	if err := s.store.AttachSignature(r.Context(), id, user.ID, body.Signature,
		s.chain.Cluster(), body.Payer, ""); err != nil {
		return storeErr(err, "Sponsorship")
	}
	return writeJSON(w, http.StatusAccepted, map[string]any{"status": "submitted"})
}

type confirmBody struct {
	Signature string `json:"signature"`
	Payer     string `json:"payer"`
	Payee     string `json:"payee"`
	Amount    int64  `json:"amount"`
}

// handleConfirmSponsorship verifies the transfer against the cluster before
// any total moves. The client's claim is only a hint about where to look; the
// numbers credited come from the chain.
func (s *Server) handleConfirmSponsorship(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireUser(r); err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Sponsorship")
	}
	var body confirmBody
	if err := decode(r, &body); err != nil {
		return err
	}

	verified, err := s.chain.VerifyTransfer(r.Context(), solana.TransferCheck{
		Signature:   body.Signature,
		From:        body.Payer,
		To:          body.Payee,
		MinLamports: body.Amount,
	})
	switch {
	case err == nil:
	case errors.Is(err, solana.ErrNotFound):
		// Not an error the sponsor can fix: the transaction may still finalize,
		// and the background reconciler will pick it up.
		return writeJSON(w, http.StatusAccepted, map[string]any{
			"status":  "pending",
			"message": "The transaction has not finalized yet. This page will update.",
		})
	case errors.Is(err, solana.ErrFailed):
		_ = s.store.FailSponsorship(r.Context(), body.Signature)
		return apierr.BadRequest("That transaction failed on chain.")
	case errors.Is(err, solana.ErrMismatch):
		s.log.WarnContext(r.Context(), "sponsorship confirmation mismatch",
			"signature", body.Signature, "sponsorship", id)
		return apierr.BadRequest("That transaction does not match this sponsorship.")
	default:
		return apierr.Internal(err)
	}

	if err := s.store.ConfirmSponsorship(r.Context(), body.Signature,
		verified.Slot, verified.Fee, verified.Raw); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Already confirmed by the reconciler; nothing left to do.
			return writeJSON(w, http.StatusOK, map[string]any{"status": "confirmed"})
		}
		return storeErr(err, "Sponsorship")
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"status":   "confirmed",
		"lamports": verified.Lamports,
		"slot":     verified.Slot,
	})
}

func (s *Server) handleVideoSponsors(w http.ResponseWriter, r *http.Request) error {
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Video")
	}
	video, err := s.store.VideoBySlug(r.Context(), slug, "")
	if err != nil {
		return storeErr(err, "Video")
	}
	sponsors, err := s.store.SponsorshipsForVideo(r.Context(), video.ID, queryInt(r, "limit", 20, 1, 50))
	if err != nil {
		return storeErr(err, "Sponsors")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Sponsorship]{Items: sponsors})
}

func (s *Server) handleMySponsorships(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	items, err := s.store.SponsorshipsForCreator(r.Context(), user.ID,
		queryInt(r, "limit", 25, 1, 100), queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Sponsorships")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Sponsorship]{Items: items})
}
