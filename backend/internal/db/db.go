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
func Connect(ctx context.Context, dsn string, maxConns int32) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse connection string: %w", err)
	}
	if maxConns > 0 {
		cfg.MaxConns = maxConns
	}
	cfg.MinConns = 0
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = time.Minute
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second

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
