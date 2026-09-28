# API reference

Base URL `http://localhost:8085` in development. Everything is JSON.

## Conventions

Errors are always the same shape:

```json
{
  "error": { "code": "validation_failed", "message": "…", "fields": { "title": "Too short." } },
  "requestId": "3f9a1c2e8b0d4a71"
}
```

`requestId` is echoed in the `X-Request-Id` header and appears in the server log
for that request, so a reported failure can be matched to the exact line.

| Code | Status | Meaning |
| --- | --- | --- |
| `validation_failed` | 422 | Per-field messages in `fields` |
| `bad_request` | 400 | Malformed body, or a page cursor that is not ours |
| `unauthorized` | 401 | Sign in |
| `forbidden` | 403 | Signed in, not allowed — or a CSRF check failed |
| `not_found` | 404 | Also returned instead of 403 where existence itself is private |
| `conflict` | 409 | Uniqueness, or a state transition that no longer applies |
| `payload_too_large` | 413 | Body over 1 MiB, or a file over `UPLOAD_MAX_BYTES` |
| `rate_limited` | 429 | See `Retry-After` and `X-RateLimit-*` |

**Every state-changing request needs both** an allowlisted `Origin` and, when a
session cookie is present, the `X-Sardhana-CSRF` header whose value is the
`sardhana_session_csrf` cookie. Missing either is a 403. Send cookies with
`credentials: "include"`.

The check runs in one middleware for the whole API, before any handler, so it
cannot be forgotten on a new endpoint. A request with no session — requesting a
sign-in link — is protected by the origin check alone, because there is no
session for a token to be bound to.

Request bodies reject unknown fields, and the error names the field that was not
recognised — a typo or a stale client becomes a fixable message rather than a
value silently ignored.

## Paging

**Every list endpoint returns the same envelope, and every one of them pages:**

```json
{ "items": [ … ], "nextCursor": "MjAyNi0wOS0yNVQxNToyNjow…" }
```

Pass `nextCursor` back as `?cursor=` for the next page. An absent or empty
`nextCursor` means that was the last page. Cursors are opaque — base64 so they
read as tokens rather than as something to construct — and a cursor that was not
issued by the endpoint you send it to is a `400`, never a silent restart from
page one.

Paging is keyset, not `OFFSET`: the cursor names the last row seen, so the cost
of page fifty is the cost of page one, a row inserted between two page loads
cannot shuffle an already-seen row onto a later page, and no request can make the
database walk a million rows to throw them away. Each query orders by its sort
column *and* the row id, so two rows sharing a timestamp still have a defined
order and a page boundary between them neither repeats nor skips either.

`?limit=` bounds one page. Defaults and maxima per endpoint are listed with each
one below; a value outside the range is clamped rather than rejected, so a stale
client still gets a usable page.

---

## Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Pings the database |
| `GET` | `/v1/timelapses` | Feed. `?limit=` (default 12, max 50), `?cursor=`, `?q=`, `?sort=` |
| `GET` | `/v1/timelapses/{slug}` | Unpublished rows: creator and admin only, else 404 |
| `GET` | `/v1/timelapses/{slug}/donations` | Confirmed supporters, largest first. `?limit=` (20, 100) |
| `GET` | `/v1/timelapses/{slug}/notes` | Peer notes, newest first. `?limit=` (100, 200) |
| `POST` | `/v1/timelapses/{slug}/views` | Counted once per viewer per day |
| `GET` | `/v1/creators/{handle}` | Public profile |
| `GET` | `/v1/creators/{handle}/timelapses` | Their published work. `?limit=` (24, 50) |
| `GET` | `/v1/stats` | Homepage totals |

`reviewNote` and `submittedAt` are stripped from every public payload.

### Reading the feed

`?q=` matches the title, the summary, the creator's display name and their
handle. Wildcards a visitor types are escaped rather than honoured — a lone `%`
finds nothing instead of scanning the table — and the term is capped at 80
characters, because the pattern length is what the match costs.

`?sort=` takes `funded`, `watched` or `longest`; anything else, including an
empty value, is newest first. An unrecognised value falls back rather than
erroring, so a stale bookmark still renders a feed.

Only the default order pages. The three ranked orders sort on a column that
moves underneath the reader — a donation lands, a view is counted — and a keyset
cursor over a moving value silently skips and repeats rows. A ranked request
therefore comes back with no `nextCursor`, and a `cursor` sent with one is
ignored.

## Authentication

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/auth/request-link` | `{ email, next? }`. Always 202, whatever happened |
| `POST` | `/v1/auth/verify` | `{ token }`. Sets the session and CSRF cookies |
| `POST` | `/v1/auth/logout` | Revokes the session |
| `GET` | `/v1/auth/session` | `{ authenticated, user? }`. Never fails |

## The signed-in account

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/me` | Private profile |
| `PATCH` | `/v1/me` | `{ displayName?, handle?, bio? }`. Absent keys are left alone |
| `GET` | `/v1/me/timelapses` | Every state, including drafts and rejections. `?limit=` (50, 100) |
| `GET` | `/v1/me/donations` | Received. `?limit=` (50, 100) |
| `POST` | `/v1/me/wallet/challenge` | `{ address }` → the message to sign |
| `POST` | `/v1/me/wallet/verify` | `{ address, nonce, signature, issuedAt }` |
| `GET` | `/v1/me/bookmarks` | Saved timelapses, most recently saved first. `?limit=` (100, 200) |
| `PUT` | `/v1/me/bookmarks/{slug}` | Save. Idempotent |
| `DELETE` | `/v1/me/bookmarks/{slug}` | Unsave. Removing one that was never saved is a 204 |

## Peer notes

Reading a thread needs no account. Writing one does, because a note is authored
speech and has to belong to somebody.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/timelapses/{slug}/notes` | `{ body, timestampSeconds? }`. `body` 2–2000 chars |
| `POST` | `/v1/timelapses/{slug}/notes/{noteId}/vote` | `{ helpful }`. Send the state you want, not a toggle |
| `DELETE` | `/v1/timelapses/{slug}/notes/{noteId}` | The author, or an admin moderating |

Every response carries two answers the caller could not work out for itself:

- `viewerHasVoted` — false for a signed-out reader, who has no identity to have
  voted with.
- `viewerCanDelete` — decided by the server, so the rule for who may moderate
  lives in one place rather than in each client.

A vote is idempotent: the caller sends the state it wants, so a double-click or a
retried request converges instead of flipping twice. An admin removing somebody
else's note is a moderation action and is written to the audit log.

All three write endpoints are 404 for a slug that is not `published`, which is
the same answer a stranger gets for a slug that does not exist — whether a given
slug is an unpublished draft is not something an anonymous caller can probe.

## Publishing

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/uploads` | `{ contentType, sizeBytes }` → presigned `PUT` URL |
| `POST` | `/v1/timelapses` | Creates a draft against an uploaded object |
| `POST` | `/v1/timelapses/{id}/uploaded` | `{ sizeBytes, durationSeconds }` |
| `POST` | `/v1/timelapses/{id}/submit` | Into the review queue |
| `PATCH` | `/v1/timelapses/{id}` | Draft, uploaded or rejected rows only |
| `DELETE` | `/v1/timelapses/{id}` | Withdraw |

## Donations

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/donations` | Records the intent. Requires a signed-in account |
| `POST` | `/v1/donations/{id}/confirm` | `{ signature }`. Only the donor who recorded the intent. Verified against the chain |

`confirm` answers `202 { status: "submitted" }` while the transaction is not yet
finalized, or when the RPC cannot be reached. Retry; nothing is lost either way,
because the settle worker finishes anything left open.

## Review — admin only

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/admin/queue` | Oldest submission first. `?limit=` (50, 100) |
| `GET` | `/v1/admin/audit` | Most recent operator actions. `?limit=` (50, 200) |
| `POST` | `/v1/admin/timelapses/{id}/approve` | Publishes |
| `POST` | `/v1/admin/timelapses/{id}/reject` | `{ note }`, 10–500 chars, required |
| `DELETE` | `/v1/admin/timelapses/{id}` | Takedown after publication |
| `GET` | `/v1/admin/members` | Most recently active first. `?q=`, `?limit=` (100, 200) |
| `POST` | `/v1/admin/members/{id}/suspend` | `{ note? }`. Revokes the member's sessions |
| `POST` | `/v1/admin/members/{id}/reinstate` | `{ note? }` |
| `GET` | `/v1/admin/ledger` | Sponsorships, newest first. `?status=`, `?limit=` (100, 200) |
| `GET` | `/v1/admin/activity` | One row per day. `?days=` (7–90) and **not** paged |

The audit trail is append-only and readable only by an admin. It is what makes
the record worth writing: an operator can see what was decided, by whom and when.
A deleted account leaves its decisions standing, attributed to nobody.

Append-only is enforced by the database, not by convention: a trigger refuses
`UPDATE` and `DELETE` on `audit_log` for every role including the owner, and the
application role is not granted either privilege. See
[database.md](database.md#the-audit-trail-is-append-only).

## Rate limits

Limits are per **class of work**, not per API. A single global budget has to be
set to whatever the busiest endpoint needs, which would let the most expensive
endpoint to abuse — requesting a sign-in link, which sends mail — run at the same
rate as reading the feed. Each route in `routes.go` names the budget it is
charged against, so the route table doubles as the rate-limit policy and a new
endpoint cannot be added without choosing one.

| Budget | Default/min | Charged to | Covers |
| --- | --- | --- | --- |
| read | `RATE_LIMIT_ANON` 300 | caller | Public GETs and `/health` |
| engage | `RATE_LIMIT_ENGAGE` 60 | caller | Views, notes, votes, bookmarks, logout |
| write | `RATE_LIMIT_WRITE` 60 | caller | Creating, editing and submitting work |
| upload | `RATE_LIMIT_UPLOAD` 10 | caller | Issuing an upload URL |
| donate | `RATE_LIMIT_DONATE` 10 | caller | Recording and confirming a sponsorship |
| auth | `RATE_LIMIT_AUTH_ATTEMPTS` 5 | **address** | Requesting a sign-in link |
| verify | `RATE_LIMIT_AUTH_ATTEMPTS` 5 | **address** | Consuming a sign-in token |
| admin | `RATE_LIMIT_ADMIN` 240 | caller | Operator console reads and decisions |

"Caller" means the account id when a session is present and the address
otherwise — the reason the limiter sits *after* session resolution. The two
sign-in budgets are always charged to the address: they are anonymous by
definition, and keying them on an account would let one session send as much mail
as it liked.

Two coarser layers sit above and below this:

- A per-address ceiling (`RATE_LIMIT_IP_CEILING`, default 1200/min) is applied
  *before* the session is resolved. It is deliberately far looser: a household, an
  office or a carrier NAT legitimately presents many callers from one address, and
  throttling them as one client is the bug this arrangement exists to avoid. What
  it bounds is how much work one address can cause before we know who is asking.
- A global per-caller backstop (`RATE_LIMIT_ANON`) wraps every route, so a class
  of work that has no budget of its own still cannot be hammered.

Every response carries the state of the budget it was charged against:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 41
```

(HTTP field names are case-insensitive, and Go's canonical form is
`X-Ratelimit-Limit` on the wire. Read them case-insensitively, as the spec
requires, and nothing here is surprising.)

and a refusal adds `Retry-After` in seconds. A `429` body is the usual error
envelope with `code: "rate_limited"` and a message naming the budget.

Limits are per process and in-memory, so they are the last line of defence behind
an edge limiter rather than a global quota. A multi-instance deployment should
also enforce limits at the edge.

## Development only

`PUT` and `GET /v1/uploads/local/{key...}` stand in for a bucket. They are
registered only when no storage credentials are configured, so a production
deployment does not carry them at all.
