package db

import "github.com/jackc/pgx/v5"

// queryExecModeExec avoids server-side prepared statements, which is required
// when connecting through a transaction-mode pooler such as Neon's.
const queryExecModeExec = pgx.QueryExecModeExec
