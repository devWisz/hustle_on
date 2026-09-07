# API reference

Base URL: `${API_PUBLIC_URL}`, currently `http://localhost:8080` in development.
All requests and responses are JSON. All state-changing requests need the
session cookie plus the `X-Sardhana-CSRF` header.

## Conventions

**Errors** carry a stable code, a safe message and, for validation failures,
per-field messages:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields need attention.",
    "fields": { "title": "Too short." }
  },
  "requestId": "9f1c2b7d4e5a6b3c"
}
```

Codes: `bad_request`, `validation_failed`, `unauthorized`, `forbidden`,
`not_found`, `conflict`, `rate_limited`, `payload_too_large`, `internal_error`.

**Lists** return `{ "items": [...], "nextCursor": "..." }`. The feed uses
keyset pagination — pass `nextCursor` back as `cursor`. Other lists take
`limit` and `offset`.

**Amounts** are lamports (integers). 1 SOL = 1,000,000,000 lamports.

## Operational

| Method | Path | Access |
| ------ | ---- | ------ |
| GET | `/health` | public |
| GET | `/health/ready` | public — checks the database |

## Authentication

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/auth/request-link` | public | `{email, next}`. Always 202, whatever the address |
| POST | `/v1/auth/verify` | public | `{token}`. Sets the session and CSRF cookies |
| POST | `/v1/auth/logout` | session | Revokes the session |
| GET | `/v1/auth/session` | public | `{authenticated, user?}` — never 401 |
| POST | `/v1/auth/wallet/challenge` | session | `{address}` → `{message, nonce, issuedAt}` |
| POST | `/v1/auth/wallet/verify` | session | `{address, nonce, signature, issuedAt, primary}` |

## The signed-in user

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/v1/me` | Full private profile |
| PATCH | `/v1/me` | Partial update; omitted fields are unchanged |
| PUT | `/v1/me/handle` | `{handle}`; 409 if taken |
| PUT | `/v1/me/social/{platform}` | `{username, url}`; the URL must match the platform's domain |
| DELETE | `/v1/me/social/{platform}` | |
| GET | `/v1/me/wallets` | |
| GET | `/v1/me/sponsorships` | Confirmed sponsorships received |
| GET | `/v1/me/notifications` | |
| POST | `/v1/me/notifications/read` | Marks all read |

## Discovery

| Method | Path | Access | Query |
| ------ | ---- | ------ | ----- |
| GET | `/v1/feed` | public | `limit`, `cursor`, `tag`, `q` |
| GET | `/v1/videos/{slug}` | public | Owners also see their own drafts |
| GET | `/v1/creators/{handle}` | public | `{creator, isFollowing}` |
| GET | `/v1/creators/{handle}/videos` | public | `limit`, `offset` |
| GET | `/v1/talent` | public | `skills`, `q`, `limit`, `offset` |
| GET | `/v1/jobs` | public | `skills`, `q`, `remote`, `limit`, `offset` |
| GET | `/v1/jobs/{slug}` | public | |

## Publishing

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/v1/uploads` | `{contentType, sizeBytes}` → presigned PUT URL and key |
| POST | `/v1/videos` | `{storageKey, title, description, sessionMinutes, visibility, tags}` |
| POST | `/v1/videos/{id}/uploaded` | `{sizeBytes, checksumSha256?}` |
| POST | `/v1/videos/{id}/publish` | |
| PATCH | `/v1/videos/{id}` | `{title?, description?, visibility?}` |
| DELETE | `/v1/videos/{id}` | Soft delete; sponsorship history survives |
| POST | `/v1/videos/{slug}/views` | public; deduplicated per viewer per day |

The upload sequence is: request a URL, PUT the file to it, register the video
against the returned key, mark it uploaded, publish.

## Discussion

| Method | Path |
| ------ | ---- |
| GET | `/v1/videos/{slug}/comments` (public) |
| POST | `/v1/videos/{slug}/comments` — `{body, parentId?}` |
| DELETE | `/v1/comments/{id}` |
| POST / DELETE | `/v1/comments/{id}/like` |

Replies are one level deep; a reply to a reply attaches to the top-level parent.

## Sponsorship

| Method | Path | Body |
| ------ | ---- | ---- |
| POST | `/v1/sponsorships` | `{creatorHandle, videoId?, amount, message?, isAnonymous}` |
| POST | `/v1/sponsorships/{id}/signature` | `{signature, payer}` |
| POST | `/v1/sponsorships/{id}/confirm` | `{signature, payer, payee, amount}` |
| GET | `/v1/videos/{slug}/sponsors` | public |

The create call returns `payTo` — the address to send to. Confirm verifies
against the cluster; a 202 with `status: "pending"` means the transaction has
not finalized and the reconciler will settle it.

## Hiring

| Method | Path | Access |
| ------ | ---- | ------ |
| POST | `/v1/jobs` | session |
| POST | `/v1/jobs/{slug}/applications` | session |
| GET | `/v1/jobs/{slug}/applications` | the client who posted it |
| POST | `/v1/applications/{id}/status` | the client who posted it |

## Trust and safety

| Method | Path | Access |
| ------ | ---- | ------ |
| POST | `/v1/reports` | session; always 202, duplicates are silent |
| GET | `/v1/admin/stats` | moderator or admin |
| GET | `/v1/admin/reports` | moderator or admin |
| POST | `/v1/admin/reports/{id}/resolve` | moderator; account actions are admin only |
