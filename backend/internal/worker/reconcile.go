// Package worker holds background jobs that run alongside the API.
package worker

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
)

// reconcileInterval is how often submitted transactions are re-checked.
const reconcileInterval = 30 * time.Second

// ReconcilePayments settles transactions that were submitted but never
// confirmed through the API.
//
// A browser can close, a network can drop, and an RPC node can lag behind the
// cluster. Without this loop those sponsorships would sit as 'submitted'
// forever, and a creator would be short money that is provably on chain.
func ReconcilePayments(ctx context.Context, log *slog.Logger, st *store.Store, chain *solana.Client) {
	ticker := time.NewTicker(reconcileInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info("payment reconciler stopped")
			return
		case <-ticker.C:
			if err := reconcileOnce(ctx, log, st, chain); err != nil {
				log.Error("reconcile pass failed", slog.Any("error", err))
			}
		}
	}
}

func reconcileOnce(ctx context.Context, log *slog.Logger, st *store.Store, chain *solana.Client) error {
	pending, err := st.PendingSignatures(ctx, 50)
	if err != nil {
		return err
	}
	for _, p := range pending {
		tx, err := chain.GetTransaction(ctx, p.Signature)
		switch {
		case errors.Is(err, solana.ErrNotFound):
			// Not yet finalized. PendingSignatures only returns the last day's
			// worth, so an abandoned intent ages out rather than being retried
			// forever.
			continue
		case err != nil:
			log.Warn("reconcile lookup failed",
				slog.String("signature", p.Signature), slog.Any("error", err))
			continue
		}

		if len(tx.Meta.Err) > 0 && string(tx.Meta.Err) != "null" {
			if err := st.FailSponsorship(ctx, p.Signature); err != nil {
				log.Error("mark sponsorship failed", slog.Any("error", err))
			}
			continue
		}

		raw, _ := marshalMeta(tx)
		if err := st.ConfirmSponsorship(ctx, p.Signature, tx.Slot, tx.Meta.Fee, raw); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				continue // already settled by the request path
			}
			log.Error("confirm sponsorship", slog.String("signature", p.Signature), slog.Any("error", err))
			continue
		}
		log.Info("sponsorship reconciled", slog.String("signature", p.Signature))
	}
	return nil
}
