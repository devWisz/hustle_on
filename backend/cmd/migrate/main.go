package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

func loadDotEnv() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				idx := strings.IndexByte(line, '=')
				if idx <= 0 {
					continue
				}
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])
				if strings.HasPrefix(val, `"`) {
					if end := strings.LastIndex(val, `"`); end > 0 {
						val = val[1:end]
					}
				} else if strings.HasPrefix(val, `'`) {
					if end := strings.LastIndex(val, `'`); end > 0 {
						val = val[1:end]
					}
				} else {
					if commentIdx := strings.Index(val, "#"); commentIdx != -1 {
						val = strings.TrimSpace(val[:commentIdx])
					}
				}
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
			break
		}
	}
}

func main() {
	loadDotEnv()

	if len(os.Args) < 2 {
		fmt.Println("usage: migrate [up|down|status|seed]")
		os.Exit(1)
	}

	dsn := os.Getenv("DATABASE_URL_DIRECT")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "error: set DATABASE_URL_DIRECT or DATABASE_URL")
		os.Exit(1)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error connecting to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	// Locate migrations directory
	rootDir := findRootDir()
	migrationsDir := filepath.Join(rootDir, "database", "migrations")

	ensureTable(ctx, conn)

	switch os.Args[1] {
	case "up":
		cmdUp(ctx, conn, migrationsDir)
	case "down":
		cmdDown(ctx, conn, migrationsDir)
	case "status":
		cmdStatus(ctx, conn, migrationsDir)
	case "seed":
		cmdSeed(ctx, conn, filepath.Join(rootDir, "database", "seeds", "dev_seed.sql"))
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}

func findRootDir() string {
	// Search upwards from current directory for database/migrations
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "database", "migrations")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "."
}

func ensureTable(ctx context.Context, conn *pgx.Conn) {
	query := `CREATE TABLE IF NOT EXISTS schema_migrations (
		version text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	);`
	if _, err := conn.Exec(ctx, query); err != nil {
		fmt.Fprintf(os.Stderr, "error creating schema_migrations table: %v\n", err)
		os.Exit(1)
	}
}

func cmdUp(ctx context.Context, conn *pgx.Conn, migrationsDir string) {
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "error listing migrations: %v\n", err)
		os.Exit(1)
	}
	sort.Strings(files)

	ran := 0
	for _, file := range files {
		base := filepath.Base(file)
		version := strings.TrimSuffix(base, ".up.sql")

		var exists int
		err := conn.QueryRow(ctx, "SELECT 1 FROM schema_migrations WHERE version=$1", version).Scan(&exists)
		if err == nil && exists == 1 {
			continue
		}

		fmt.Printf("applying %s\n", version)
		content, err := os.ReadFile(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error reading %s: %v\n", file, err)
			os.Exit(1)
		}

		tx, err := conn.Begin(ctx)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error starting transaction: %v\n", err)
			os.Exit(1)
		}

		// Advisory lock
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(8123456789);"); err != nil {
			tx.Rollback(ctx)
			fmt.Fprintf(os.Stderr, "error acquiring lock: %v\n", err)
			os.Exit(1)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			tx.Rollback(ctx)
			fmt.Fprintf(os.Stderr, "error executing migration %s: %v\n", version, err)
			os.Exit(1)
		}

		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
			tx.Rollback(ctx)
			fmt.Fprintf(os.Stderr, "error recording migration %s: %v\n", version, err)
			os.Exit(1)
		}

		if err := tx.Commit(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "error committing migration %s: %v\n", version, err)
			os.Exit(1)
		}
		ran++
	}

	if ran == 0 {
		fmt.Println("already up to date")
	} else {
		fmt.Printf("applied %d migration(s)\n", ran)
	}
}

func cmdDown(ctx context.Context, conn *pgx.Conn, migrationsDir string) {
	var version string
	err := conn.QueryRow(ctx, "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").Scan(&version)
	if err != nil {
		fmt.Println("nothing to roll back")
		return
	}

	file := filepath.Join(migrationsDir, version+".down.sql")
	content, err := os.ReadFile(file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading %s: %v\n", file, err)
		os.Exit(1)
	}

	fmt.Printf("reverting %s\n", version)
	tx, err := conn.Begin(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error starting transaction: %v\n", err)
		os.Exit(1)
	}

	if _, err := tx.Exec(ctx, string(content)); err != nil {
		tx.Rollback(ctx)
		fmt.Fprintf(os.Stderr, "error executing rollback %s: %v\n", version, err)
		os.Exit(1)
	}

	if _, err := tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version=$1", version); err != nil {
		tx.Rollback(ctx)
		fmt.Fprintf(os.Stderr, "error updating schema_migrations: %v\n", err)
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "error committing rollback %s: %v\n", version, err)
		os.Exit(1)
	}
	fmt.Printf("reverted %s\n", version)
}

func cmdStatus(ctx context.Context, conn *pgx.Conn, migrationsDir string) {
	rows, err := conn.Query(ctx, "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error getting applied migrations: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	fmt.Println("applied:")
	for rows.Next() {
		var v string
		rows.Scan(&v)
		applied[v] = true
		fmt.Printf("  %s\n", v)
	}

	files, _ := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	sort.Strings(files)

	fmt.Println("pending:")
	for _, f := range files {
		v := strings.TrimSuffix(filepath.Base(f), ".up.sql")
		if !applied[v] {
			fmt.Printf("  %s\n", v)
		}
	}
}

func cmdSeed(ctx context.Context, conn *pgx.Conn, seedFile string) {
	if os.Getenv("APP_ENV") == "production" {
		fmt.Fprintln(os.Stderr, "refusing to seed a production database")
		os.Exit(1)
	}

	content, err := os.ReadFile(seedFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading seed file: %v\n", err)
		os.Exit(1)
	}

	if _, err := conn.Exec(ctx, string(content)); err != nil {
		fmt.Fprintf(os.Stderr, "error running seed SQL: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("seed data loaded")
}
