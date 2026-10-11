package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// The operator's window onto the money side.
//
// Sponsorships move wallet to wallet, so the platform never holds funds — but it
// does decide what it believes happened on chain, and a donor whose payment has
// not shown up has nobody else to ask. These two endpoints are what makes that
// answerable on the spot instead of after the next sweep.

// handleAdminChainStatus reports which cluster the API is reading and whether the
// RPC endpoint is answering.
//
// It deliberately reports the cluster as a value rather than hiding it: a
// deployment pointed at devnet while the site tells donors to send SOL is the kind
// of mistake that costs real money, and it is invisible until somebody looks.
func (s *Server) handleAdminChainStatus(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	// The check is made with a short deadline of its own so a hung RPC endpoint
	// cannot hold the console open for the API's full request timeout.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	reachable := true
	detail := "ok"
	if err := s.chain.Health(ctx); err != nil {
		reachable = false
		detail = "The RPC endpoint did not answer a health check."
		if errors.Is(err, solana.ErrRPCRequest) {
			s.log.WarnContext(r.Context(), "chain health check failed", "error", err)
		} else {
			s.log.ErrorContext(r.Context(), "chain health check failed", "error", err)
		}
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"cluster":   s.chain.Cluster(),
		"reachable": reachable,
		"detail":    detail,
		"checkedAt": time.Now().UTC(),
	})
}

// handleAdminRecheckDonation re-verifies one donation against the chain now.
//
// The settle loop already retries unconfirmed donations every couple of minutes,
// so this is not a repair path: it is the answer to "I paid and it is not showing",
// given while the person is still on the page. The verification is the same one
// the donor's own confirmation runs — the amount and the recipient come from the
// stored intent, never from the request — so an operator cannot credit a donation
// that the chain does not support.
func (s *Server) handleAdminRecheckDonation(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Donation")
	}
	d, err := s.store.DonationByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Donation")
	}
	if d.Status == "confirmed" {
		return writeJSON(w, http.StatusOK, map[string]any{
			"status":  "confirmed",
			"message": "This donation was already credited.",
		})
	}
	if d.Signature == "" {
		return apierr.Conflict("No transaction signature has been submitted for this donation yet.")
	}

	verified, err := s.chain.VerifyTransfer(r.Context(), solana.TransferCheck{
		Signature:   d.Signature,
		From:        d.DonorAddress,
		To:          d.PayoutAddress,
		MinLamports: d.Amount,
	})
	switch {
	case err == nil:
		if err := s.store.ConfirmDonation(r.Context(), d.ID, verified.Slot, verified.Raw, time.Now().UTC()); err != nil {
			return storeErr(err, "Donation")
		}
		s.audit(r, admin.ID, "donation.recheck", "donation", d.ID,
			map[string]any{"result": "confirmed", "lamports": d.Amount})
		return writeJSON(w, http.StatusOK, map[string]any{
			"status":         "confirmed",
			"amountLamports": d.Amount,
		})

	case errors.Is(err, solana.ErrNotFound):
		return writeJSON(w, http.StatusAccepted, map[string]any{
			"status":  "submitted",
			"message": "The network has not finalized that transaction yet.",
		})

	case errors.Is(err, solana.ErrFailed), errors.Is(err, solana.ErrMismatch):
		// The chain answered, and the answer is no. Recording that is what stops
		// the same dead signature being offered again.
		if err := s.store.FailDonation(r.Context(), d.ID); err != nil {
			s.log.ErrorContext(r.Context(), "mark donation failed", "donation", d.ID, "error", err)
		}
		s.audit(r, admin.ID, "donation.recheck", "donation", d.ID, map[string]any{"result": "failed"})
		return apierr.BadRequest("That transaction does not match this donation.")

	default:
		s.log.ErrorContext(r.Context(), "recheck donation", "donation", d.ID, "error", err)
		return writeJSON(w, http.StatusAccepted, map[string]any{
			"status":  "submitted",
			"message": "The network could not be reached. The automatic retry will try again.",
		})
	}
}
