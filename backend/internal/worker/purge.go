package worker

import (
	"context"
	"log/slog"
	"time"

	"github.com/sardhana/backend/internal/store"
)

const purgeInterval = 24 * time.Hour

// PurgeExpiredAuth deletes wallet challenges and sessions that stopped working
// more than a month ago. It runs once at start and then daily.
//
// There used to be a third category — sign-in links — and this loop named it in
// its log line. With the links gone the count is smaller, and the log says so
// rather than printing a number that is always zero.
func PurgeExpiredAuth(ctx context.Context, log *slog.Logger, st *store.Store) {
	purge := func() {
		challenges, sessions, err := st.PurgeExpiredAuth(ctx)
		if err != nil {
			log.ErrorContext(ctx, "purge: expired auth rows", "error", err)
			return
		}
		if challenges+sessions > 0 {
			log.InfoContext(ctx, "purged expired auth rows",
				"challenges", challenges, "sessions", sessions)
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
