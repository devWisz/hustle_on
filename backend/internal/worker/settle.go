// Package worker holds the background loops the API runs alongside its HTTP
// server. There is one: settling donations that were signed but never
// confirmed back to us.
package worker

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
)

// settleInterval is how often the sweep runs. Donations settle in seconds on
// chain; this is a safety net for lost confirmations, not the primary path, so
// it can afford to be unhurried.
const settleInterval = 2 * time.Minute

// donationTTL is how long an unsettled intent is retried before it is written
// off. A signature that has not finalized within this window never will.
const donationTTL = 30 * time.Minute

// SettleDonations verifies claimed-but-unconfirmed donations until ctx is done.
//
// The gap it closes is small but real: a donor signs, the wallet returns a
// signature, and the browser is closed before the confirmation request lands.
// The money has moved; without this loop nothing would ever record that.
func SettleDonations(ctx context.Context, log *slog.Logger, st *store.Store, chain *solana.Client) {
	ticker := time.NewTicker(settleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			settleOnce(ctx, log, st, chain)
		}
	}
}

func settleOnce(ctx context.Context, log *slog.Logger, st *store.Store, chain *solana.Client) {
	pending, err := st.UnsettledDonations(ctx, 50)
	if err != nil {
		log.ErrorContext(ctx, "settle: list unsettled donations", "error", err)
		return
	}

	for _, d := range pending {
		// An intent that was never signed has no signature to check; it is only
		// expired once it is old enough that it plainly never will be.
		if d.Signature == "" {
			if time.Since(d.CreatedAt) > donationTTL {
				if err := st.FailDonation(ctx, d.ID); err != nil {
					log.ErrorContext(ctx, "settle: expire donation", "id", d.ID, "error", err)
				}
			}
			continue
		}

		verified, err := chain.VerifyTransfer(ctx, solana.TransferCheck{
			Signature:   d.Signature,
			From:        d.DonorAddress,
			To:          d.PayoutAddress,
			MinLamports: d.Amount,
		})
		switch {
		case err == nil:
			if err := st.ConfirmDonation(ctx, d.ID, verified.Slot, verified.Raw, time.Now().UTC()); err != nil {
				log.ErrorContext(ctx, "settle: confirm donation", "id", d.ID, "error", err)
				continue
			}
			log.InfoContext(ctx, "settled donation late", "id", d.ID, "lamports", verified.Lamports)

		case errors.Is(err, solana.ErrNotFound):
			// Still not finalized. Leave it for the next sweep, unless it has
			// been waiting long enough that it never will be.
			if time.Since(d.CreatedAt) > donationTTL {
				if err := st.FailDonation(ctx, d.ID); err != nil {
					log.ErrorContext(ctx, "settle: expire donation", "id", d.ID, "error", err)
				}
			}

		case errors.Is(err, solana.ErrFailed), errors.Is(err, solana.ErrMismatch):
			if err := st.FailDonation(ctx, d.ID); err != nil {
				log.ErrorContext(ctx, "settle: fail donation", "id", d.ID, "error", err)
			}

		default:
			// An RPC outage is transient: leave the row alone and try again.
			log.WarnContext(ctx, "settle: rpc unavailable", "id", d.ID, "error", err)
			return
		}
	}
}
