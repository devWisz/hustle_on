# Contributing

## Before you push

```bash
make fmt
make lint
make test
```

`make test` runs `go test ./... -race` in both modules and `tsc --noEmit` in the
frontend.

If you touched the schema, apply and roll back both directions against a scratch
database before committing:

```bash
docker run -d --name scratch -e POSTGRES_PASSWORD=x -e POSTGRES_DB=x -p 55432:5432 postgres:16-alpine
DATABASE_URL_DIRECT=postgres://postgres:x@localhost:55432/x?sslmode=disable bash scripts/migrate.sh up
DATABASE_URL_DIRECT=… bash scripts/migrate.sh down
```

## Where things go

| Change | File |
| --- | --- |
| A new endpoint | `internal/server/routes.go`, then a handler |
| Any SQL | `internal/store` — nowhere else |
| A field clients should see | `internal/domain` |
| An input rule | `internal/validate` |
| Sign-in or wallet rules | the `auth` module |
| A colour, radius or shadow | `app/globals.css`, and `docs/design-system.md` |
| A UI primitive | `components/ui.tsx` |

## House rules

**Handlers never write SQL.** They call store methods. Every statement uses
bound parameters; string interpolation into SQL is not permitted in `store`.

**A column is invisible until it is in `domain`.** That default is the reason
email addresses and review notes do not leak onto public payloads. Adding a
field there is a deliberate act.

**Put the rule in the database when it can go there.** A `CHECK` makes an
invalid state impossible; a comment makes it discouraged. See the constraint
list in `docs/database.md` for the shape of what belongs there.

**Return 404 where existence is private.** A 403 confirms the thing exists.

**Never fabricate content in the UI.** No placeholder people, no sample metrics,
no simulated player. An honest empty state is always better.

**No emoji in the interface.** Icons are inline SVG in `components/icons.tsx`.

## Comments

Comment the *why*, not the *what*. The code already says what it does.

```go
// Good: says why the shape is what it is.
//
// The balance delta is read from the transaction meta rather than trusting any
// instruction decoding, because the delta is what actually happened: it cannot
// be faked by a transaction that emits convincing logs but transfers nothing.

// Bad: restates the line below it.
// Get the transaction.
```

If a line looks wrong but is correct, that is the line that needs a comment.

## Commits

Present tense, one change per commit, and say why in the body if it is not
obvious from the diff.

```
Verify donation signatures at the edge

An RPC answers a malformed signature with "invalid param", which the API
could only report as a 500. Checking the base58 encoding first turns it
into a 422 the donor can act on.
```

## Tests

Test what could plausibly break and what would be expensive if it did:
authentication rules, input validation, cursor encoding, on-chain verification.

The `auth` module is tested against an in-memory store, so its rules are covered
without a database. Keep it that way — those are exactly the rules you want
covered by tests that always run.

## Documentation

If you change behaviour somebody depends on, update the document that describes
it. `docs/workflow.md` describes the one path through the product; if your
change alters that path, it belongs there.

Decision records in `docs/adr/` are historical. Do not edit them when the code
changes — add a new one that supersedes the old.
