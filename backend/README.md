# backend

The Sardhana HTTP API, written in Go with no web framework — `net/http` plus
the routing patterns added in Go 1.22.

## Layout

```
cmd/api            process entry point and dependency wiring
internal/config    environment loading and startup validation
internal/server    routing, middleware, handlers
internal/store     every SQL statement in the codebase
internal/domain    the JSON contract returned to clients
internal/solana    JSON-RPC verification of on-chain transfers
internal/media     presigned upload URLs (AWS SigV4)
internal/worker    background settlement of unconfirmed donations
internal/validate  shared input rules
pkg/apierr         the one error type the HTTP layer renders
```

## Running

```bash
go run ./cmd/api        # reads .env from the repository root via the dev script
go test ./... -race
```

## Design rules

**Handlers return errors, they do not write them.** Every route has the
signature `func(http.ResponseWriter, *http.Request) error`; `wrap` renders the
result. That is why no handler can accidentally leak a driver error to a
client — rendering happens in one place, in `render.go`.

**All SQL lives in `internal/store`.** Statements use bound parameters
exclusively. No handler builds a query, so injection is prevented by structure
rather than by review.

**Authorisation is expressed in the statement where it can be.** Editing a
timelapse, for example, carries `user_id = $2 AND status IN ('draft',
'uploaded', 'rejected')` in the `UPDATE` itself, so someone else's row — or a
row already in review — matches nothing, rather than relying on a check a
future edit might drop.

**Nothing on chain is trusted until it is read back.** A client reporting a
signature only tells the API where to look; `internal/solana` fetches the
finalized transaction and checks the balance deltas before any total moves.

**Counters move inside the transaction that causes them.** Approving a
timelapse and incrementing its creator's published count are one write; a
confirmed donation and both totals it credits are one write.

## Adding an endpoint

1. Add the route to `routes.go`, in the section matching its access level.
2. Write the handler; call `requireUser` or `requireAdmin` first, then
   `s.checkCSRF(r)` for anything that changes state.
3. Validate input with `internal/validate` before it reaches the store.
4. Add the store method, with bound parameters and an ownership predicate.
5. Add the response type to `internal/domain` if clients need a new shape.
6. Document it in `docs/api.md`.
