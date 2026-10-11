SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup dev dev-api dev-web build test lint fmt \
        db-migrate db-rollback db-status db-seed preflight \
        program-build program-check program-deploy e2e e2e-clean clean

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies for every workspace
	cd backend && go mod download
	cd auth && go mod download
	cd frontend && npm install

dev: ## Run the API and the web app together
	@bash scripts/dev.sh

dev-api: ## Run the Go API on :8085
	cd backend && go run ./cmd/api

dev-web: ## Run the Next.js app on :3000
	cd frontend && npm run dev

build: ## Build every deployable artifact
	cd backend && go build -trimpath -ldflags="-s -w" -o bin/api ./cmd/api
	cd frontend && npm run build

test: ## Run all test suites
	cd backend && go test ./... -race -count=1
	cd auth && go test ./... -race -count=1
	cd frontend && npm run typecheck

lint: ## Static analysis across workspaces
	cd backend && go vet ./...
	cd auth && go vet ./...
	cd frontend && npm run lint

fmt: ## Format all source
	cd backend && gofmt -w .
	cd auth && gofmt -w .
	cd frontend && npm run format

db-migrate: ## Apply pending migrations
	@bash scripts/migrate.sh up

db-rollback: ## Roll back the most recent migration
	@bash scripts/migrate.sh down

db-status: ## Show applied and pending migrations
	@bash scripts/migrate.sh status

db-seed: ## Load development seed data
	@bash scripts/migrate.sh seed

preflight: ## Check the environment for production readiness
	@bash scripts/preflight.sh

program-build: ## Build the sponsorship Anchor program
	cd contracts && anchor build

program-check: ## Check the deployed program is usable (exit 0 only if sponsorships would work)
	@NODE_PATH="$$PWD/frontend/node_modules" node contracts/scripts/check-program.cjs

program-deploy: ## Build, deploy and initialize the program, then verify it
	@bash scripts/deploy-program.sh

e2e: ## Walk the whole creator journey against a running API (needs make dev)
	cd backend && go run ./cmd/e2echeck

e2e-clean: ## Remove what the end-to-end check left behind
	@set -a; . ./.env; set +a; \
	  psql "$$DATABASE_URL_DIRECT" -q -v ON_ERROR_STOP=1 \
	    -c "BEGIN;" \
	    -c "ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;" \
	    -c "DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM users WHERE handle LIKE 'hustler\\_%');" \
	    -c "DELETE FROM donations;" \
	    -c "DELETE FROM timelapses;" \
	    -c "DELETE FROM users WHERE handle LIKE 'hustler\\_%';" \
	    -c "ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;" \
	    -c "COMMIT;" \
	    -c "SELECT * FROM recount_totals();" && \
	  rm -rf backend/data && echo "removed the end-to-end check's rows and local uploads"

clean: ## Remove build output
	rm -rf backend/bin backend/data frontend/.next
