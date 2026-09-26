package worker

import (
	"context"
	"log/slog"
	"time"

	"github.com/sardhana/backend/internal/store"
)

const purgeInterval = 24 * time.Hour

// PurgeExpiredAuth deletes sign-in links, wallet challenges and sessions that
// stopped working more than a month ago. It runs once at start and then daily.
func PurgeExpiredAuth(ctx context.Context, log *slog.Logger, st *store.Store) {
	purge := func() {
		links, challenges, sessions, err := st.PurgeExpiredAuth(ctx)
		if err != nil {
			log.ErrorContext(ctx, "purge: expired auth rows", "error", err)
			return
		}
		if links+challenges+sessions > 0 {
			log.InfoContext(ctx, "purged expired auth rows",
				"links", links, "challenges", challenges, "sessions", sessions)
		}
	}

	purge()
	ticker := time.NewTicker(purgeInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			purge()
		}
	}
}
