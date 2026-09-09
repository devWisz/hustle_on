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
| `GET` | `/v1/timelapses` | Feed. `?limit=` (1–50), `?cursor=` |
| `GET` | `/v1/timelapses/{slug}` | Unpublished rows: creator and admin only, else 404 |
| `GET` | `/v1/timelapses/{slug}/donations` | Confirmed supporters |
| `POST` | `/v1/timelapses/{slug}/views` | Counted once per viewer per day |
| `GET` | `/v1/creators/{handle}` | Public profile |
| `GET` | `/v1/creators/{handle}/timelapses` | Their published work |
| `GET` | `/v1/stats` | Homepage totals |

`reviewNote` and `submittedAt` are stripped from every public payload.

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
| `POST` | `/v1/admin/timelapses/{id}/approve` | Publishes |
| `POST` | `/v1/admin/timelapses/{id}/reject` | `{ note }`, 10–500 chars, required |
| `DELETE` | `/v1/admin/timelapses/{id}` | Takedown after publication |

## Development only

`PUT` and `GET /v1/uploads/local/{key...}` stand in for a bucket. They are
registered only when no storage credentials are configured, so a production
deployment does not carry them at all.
