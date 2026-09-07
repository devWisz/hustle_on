SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup dev dev-backend dev-frontend dev-admin build test lint fmt \
        db-migrate db-rollback db-seed contracts-build contracts-test clean

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies for every workspace
	cd backend && go mod download
	cd auth && go mod download
	cd frontend && npm install
	cd admin && npm install
	cd contracts && npm install

dev: ## Run backend, frontend and admin together
	@bash scripts/dev.sh

dev-backend: ## Run the Go API with live reload if air is installed
	cd backend && (command -v air >/dev/null && air || go run ./cmd/api)

dev-frontend: ## Run the public Next.js app on :3000
	cd frontend && npm run dev

dev-admin: ## Run the admin console on :3001
	cd admin && npm run dev

build: ## Build every deployable artifact
	cd backend && go build -trimpath -ldflags="-s -w" -o bin/api ./cmd/api
	cd frontend && npm run build
	cd admin && npm run build

test: ## Run all test suites
	cd backend && go test ./... -race -count=1
	cd auth && go test ./... -race -count=1
	cd frontend && npm run test --if-present
	cd contracts && anchor test --skip-local-validator || true

lint: ## Static analysis across workspaces
	cd backend && go vet ./...
	cd auth && go vet ./...
	cd frontend && npm run lint
	cd admin && npm run lint
	cd contracts && cargo clippy --all-targets -- -D warnings

fmt: ## Format all source
	cd backend && gofmt -w .
	cd auth && gofmt -w .
	cd frontend && npm run format --if-present
	cd contracts && cargo fmt

db-migrate: ## Apply pending migrations
	@bash scripts/migrate.sh up

db-rollback: ## Roll back the most recent migration
	@bash scripts/migrate.sh down

db-seed: ## Load development seed data
	@bash scripts/migrate.sh seed

contracts-build: ## Build the Anchor program
	cd contracts && anchor build

contracts-test: ## Run Anchor integration tests
	cd contracts && anchor test

clean: ## Remove build output
	rm -rf backend/bin frontend/.next admin/.next contracts/target
