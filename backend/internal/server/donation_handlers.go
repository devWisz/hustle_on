package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

type createDonationBody struct {
	Slug         string `json:"slug"`
	DonorAddress string `json:"donorAddress"`
	Amount       int64  `json:"amountLamports"`
	Message      string `json:"message"`
}

// handleCreateDonation records the intent and returns what the client needs to
// build the transaction.
//
// The recipient and the amount are fixed here, on the server, before anything
// is signed. That is what makes the confirmation step meaningful: it compares
// the chain against a number the client did not get to choose after the fact.
func (s *Server) handleCreateDonation(w http.ResponseWriter, r *http.Request) error {
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body createDonationBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if !validate.IsSlug(body.Slug) {
		return apierr.NotFound("Timelapse")
	}
	v := validate.New().PositiveAmount("amountLamports", body.Amount)
	if err := auth.ValidateSolanaAddress(body.DonorAddress); err != nil {
		v.Add("donorAddress", "Enter a valid Solana address.")
	}
	message := validate.CleanText(body.Message)
	v.Length("message", message, 0, 280)
	if v.Any() {
		return v.Err()
	}

	t, err := s.store.BySlug(r.Context(), body.Slug)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	// Only published work can be funded. A submission still in review has not
	// been checked by anyone, and money should not move against it.
	if t.Status != "published" {
		return apierr.NotFound("Timelapse")
	}

	payout, err := s.store.PayoutAddress(r.Context(), t.Creator.ID)
	if err != nil {
		return storeErr(err, "Creator")
	}
	if payout == "" {
		return apierr.Conflict("This creator has not set up a wallet to receive donations yet.")
	}

	var donorID string
	if u, ok := currentUser(r); ok {
		if u.ID == t.Creator.ID {
			return apierr.BadRequest("You cannot donate to your own timelapse.")
		}
		donorID = u.ID
	}

	id, err := s.store.CreateDonation(r.Context(), store.NewDonation{
		TimelapseID:   t.ID,
		CreatorID:     t.Creator.ID,
		DonorID:       donorID,
		DonorAddress:  body.DonorAddress,
		PayoutAddress: payout,
		Amount:        body.Amount,
		Message:       message,
		Cluster:       s.chain.Cluster(),
	})
	if err != nil {
		return storeErr(err, "Donation")
	}

	return writeJSON(w, http.StatusCreated, domain.DonationIntent{
		ID:        id,
		Recipient: payout,
		Amount:    body.Amount,
		Cluster:   s.chain.Cluster(),
	})
}

type confirmDonationBody struct {
	Signature string `json:"signature"`
}

// handleConfirmDonation verifies a signature against the chain and credits it.
//
// A signature from a browser is a claim, not evidence. Nothing is counted until
// this handler has fetched the finalized transaction from an RPC node and seen
// that the recipient's balance actually rose by at least the promised amount.
func (s *Server) handleConfirmDonation(w http.ResponseWriter, r *http.Request) error {
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Donation")
	}
	var body confirmDonationBody
	if err := decode(r, &body); err != nil {
		return err
	}
	// Checked here rather than left to the RPC node: a malformed signature comes
	// back from an RPC as an opaque "invalid param", which the API could only
	// report as its own failure when it is in fact bad input.
	if err := auth.ValidateSignature(body.Signature); err != nil {
		return apierr.Validation("That is not a valid transaction signature.").
			WithField("signature", "Enter the signature returned by your wallet.")
	}

	pending, err := s.store.ClaimDonation(r.Context(), id, body.Signature)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return apierr.Conflict("That transaction has already been recorded.")
		}
		return storeErr(err, "Donation")
	}

	verified, err := s.chain.VerifyTransfer(r.Context(), solana.TransferCheck{
		Signature:   body.Signature,
		From:        pending.DonorAddress,
		To:          pending.PayoutAddress,
		MinLamports: pending.Amount,
	})
	switch {
	case err == nil:
	case errors.Is(err, solana.ErrNotFound):
		// Not yet finalized. The intent stays claimable so the client can retry
		// in a few seconds rather than losing the donation to a timing race.
		return writeJSON(w, http.StatusAccepted, map[string]any{
			"status":  "submitted",
			"message": "The transaction has not finalized yet. Try again in a moment.",
		})
	case errors.Is(err, solana.ErrFailed), errors.Is(err, solana.ErrMismatch):
		if err := s.store.FailDonation(r.Context(), pending.ID); err != nil {
			s.log.ErrorContext(r.Context(), "mark donation failed", "error", err)
		}
		return apierr.BadRequest("That transaction does not match this donation.")
	default:
		// The chain is unreachable, not wrong. The intent is left claimable and
		// the settle loop will finish it, so the donor is told to wait rather
		// than being handed a failure for money that may well have moved.
		s.log.ErrorContext(r.Context(), "verify donation", "id", pending.ID, "error", err)
		return writeJSON(w, http.StatusAccepted, map[string]any{
			"status":  "submitted",
			"message": "We could not reach the network to confirm this yet. It will be credited automatically once we can.",
		})
	}

	if err := s.store.ConfirmDonation(r.Context(), pending.ID,
		verified.Slot, verified.Raw, time.Now().UTC()); err != nil {
		return storeErr(err, "Donation")
	}

	return writeJSON(w, http.StatusOK, map[string]any{
		"status":         "confirmed",
		"signature":      body.Signature,
		"amountLamports": pending.Amount,
	})
}
