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
| `unauthorized` | 401 | Sign in |
| `forbidden` | 403 | Signed in, not allowed — or a CSRF check failed |
| `not_found` | 404 | Also returned instead of 403 where existence itself is private |
| `conflict` | 409 | Uniqueness, or a state transition that no longer applies |
| `rate_limited` | 429 | See `Retry-After` |

**Every state-changing request needs both** an allowlisted `Origin` and the
`X-Sardhana-CSRF` header, whose value is the `sardhana_session_csrf` cookie.
Missing either is a 403. Send cookies with `credentials: "include"`.

Request bodies reject unknown fields, and the error names the field that was not
recognised — a typo or a stale client becomes a fixable message rather than a
value silently ignored.

List endpoints return `{ "items": [...] }`. The feed adds an opaque
`nextCursor`; pass it back as `?cursor=`. Paging is keyset, so a donation
landing between two page loads cannot shuffle a row from page two onto page one.

---

## Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Pings the database |
| `GET` | `/v1/timelapses` | Feed. `?limit=` (1–50), `?cursor=`, `?q=`, `?sort=` |
| `GET` | `/v1/timelapses/{slug}` | Unpublished rows: creator and admin only, else 404 |
| `GET` | `/v1/timelapses/{slug}/donations` | Confirmed supporters |
| `GET` | `/v1/timelapses/{slug}/notes` | Peer notes, newest first |
| `POST` | `/v1/timelapses/{slug}/views` | Counted once per viewer per day |
| `GET` | `/v1/creators/{handle}` | Public profile |
| `GET` | `/v1/creators/{handle}/timelapses` | Their published work |
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
| `GET` | `/v1/me/timelapses` | Every state, including drafts and rejections |
| `GET` | `/v1/me/donations` | Received |
| `POST` | `/v1/me/wallet/challenge` | `{ address }` → the message to sign |
| `POST` | `/v1/me/wallet/verify` | `{ address, nonce, signature, issuedAt }` |
| `GET` | `/v1/me/bookmarks` | Saved timelapses, most recently saved first |
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
| `POST` | `/v1/donations` | Records the intent. Signing in is optional |
| `POST` | `/v1/donations/{id}/confirm` | `{ signature }`. Verified against the chain |

`confirm` answers `202 { status: "submitted" }` while the transaction is not yet
finalized, or when the RPC cannot be reached. Retry; nothing is lost either way,
because the settle worker finishes anything left open.

## Review — admin only

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/admin/queue` | Oldest submission first |
| `GET` | `/v1/admin/audit` | Most recent operator actions, `?limit=` (1–200) |
| `POST` | `/v1/admin/timelapses/{id}/approve` | Publishes |
| `POST` | `/v1/admin/timelapses/{id}/reject` | `{ note }`, 10–500 chars, required |
| `DELETE` | `/v1/admin/timelapses/{id}` | Takedown after publication |

The audit trail is append-only and readable only by an admin. It is what makes
the record worth writing: an operator can see what was decided, by whom and when.
A deleted account leaves its decisions standing, attributed to nobody.

## Rate limits

Two budgets apply, and they are keyed differently on purpose.

A per-address ceiling (`RATE_LIMIT_IP_CEILING`, default 600/min) is applied
*before* the session is resolved. It is deliberately far looser than the real
budget: a household, an office or a carrier NAT can present thousands of distinct
callers from one address, and throttling all of them as one client is the bug
this arrangement exists to avoid. What it bounds is how much work one address can
cause ahead of authentication.

The meaningful budget (`RATE_LIMIT_ANON`, default 60/min) is applied *after*, and
is keyed by user id when the caller is signed in and by address when they are
not. Sign-in attempts have their own far tighter budget
(`RATE_LIMIT_AUTH_ATTEMPTS`, default 5/min).

## Development only

`PUT` and `GET /v1/uploads/local/{key...}` stand in for a bucket. They are
registered only when no storage credentials are configured, so a production
deployment does not carry them at all.
