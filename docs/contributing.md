# Contributing

## Before you start

```bash
make setup
make db-migrate
make dev
```

Read `docs/architecture.md` for the shape of the system, and `docs/security.md`
before touching authentication, uploads or payment verification.

## Layout

One concern per workspace. Code that belongs to two of them belongs to neither
— extract it, as `auth/` was extracted from the backend.

## Conventions

**Go.** `gofmt` and `go vet` clean. Errors wrap with `%w`. Handlers return
errors rather than writing them. All SQL lives in `internal/store` and uses
bound parameters — no exceptions. Every new endpoint gets a line in
`routes.go` under the section matching its access level, and a row in
`docs/api.md`.

**TypeScript.** `strict` plus `noUncheckedIndexedAccess`. No `any`. API shapes
live in `lib/types.ts` and mirror `backend/internal/domain`. Components are
server components unless they need state or an event handler.

**CSS.** Tokens only. A component that needs a colour that is not a token needs
a discussion, then a token.

**Rust.** `cargo fmt`, `cargo clippy -D warnings`. Checked arithmetic on
anything touching an amount. Every new instruction needs an accounts struct
whose constraints are the authorisation.

## Comments

Explain the reason, not the mechanics. `// increment the counter` is noise;
`// counters move inside the transaction that causes them, so a partial write
cannot be observed` is the reason someone needs six months from now. Security
decisions are always worth a comment, because they usually look like extra work
until you know what they prevent.

## Tests

Add a test when you fix a bug, and when you write anything that decides who may
do what. Existing suites to extend:

```bash
cd backend && go test ./... -race
cd auth && go test ./...
cd contracts && anchor test
```

## Pull requests

Small and focused. The description says what changed and why, and names
anything a reviewer should look at closely. CI must be green: `go vet`, both
test suites, both Next.js builds, and `cargo clippy`.

Changes touching authentication, payment verification or the program get a
second reviewer.
