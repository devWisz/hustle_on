// Package db owns the Postgres connection pool.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pool against Neon and verifies it before returning.
//
// Use the pooled (-pooler) Neon endpoint here. Neon computes also scale to
// zero when idle, so the first query after a quiet period pays a cold start;
// the health check below absorbs it at boot rather than in a user request.
//
// Timeouts that protect the *server* — statement_timeout, lock_timeout, the
// idle-in-transaction guard — are set on the application's database role rather
// than here. A pooled endpoint does not reliably forward startup parameters to
// the backend that ends up serving a connection, so a value sent in the
// connection string can apply to some connections and not others. See
// database/migrations/0008_security_hardening.up.sql.
func Connect(ctx context.Context, dsn string, maxConns int32) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse connection string: %w", err)
	}
	if maxConns > 0 {
		cfg.MaxConns = maxConns
	}
	// No idle floor: Neon bills and scales by activity, so holding connections
	// open to save a cold start is the wrong trade for this deployment.
	cfg.MinConns = 0
	cfg.MaxConnLifetime = 30 * time.Minute
	// Without jitter every connection in the pool is recycled at the same
	// instant, which shows up as a periodic stall rather than the steady trickle
	// the lifetime is meant to be.
	cfg.MaxConnLifetimeJitter = 5 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = time.Minute
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second

	// Statements and lock waits are attributed to this name in pg_stat_activity,
	// which is what makes "who is holding this lock" answerable during an
	// incident instead of a guess.
	if cfg.ConnConfig.RuntimeParams == nil {
		cfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	cfg.ConnConfig.RuntimeParams["application_name"] = "hustleon-api"

	// Statement caching interacts badly with connection poolers in transaction
	// mode: a prepared statement may not exist on the backend the pooler hands
	// out next. Describing each statement on execution is the safe mode.
	cfg.ConnConfig.DefaultQueryExecMode = queryExecModeExec

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return pool, nil
}
