# API reference

Base URL: `${API_PUBLIC_URL}`, currently `http://localhost:8085` in development.
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

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| GET | `/health` | public | Process liveness and cluster info |
| GET | `/healthz` | public | Alias for `/health` |
| GET | `/health/ready` | public | Database connectivity check |

## Development uploads

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| PUT | `/v1/uploads/local/{key...}` | public (dev) | Local direct upload endpoint |
| GET | `/v1/uploads/local/{key...}` | public (dev) | Serve local uploaded media |

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

| Method | Path | Access | Query | Notes |
| ------ | ---- | ------ | ----- | ----- |
| GET | `/v1/feed` | public | `limit`, `cursor`, `tag`, `q` | Keyset pagination via cursor |
| GET | `/v1/videos/{slug}` | public | | Owners also see their own drafts |
| GET | `/v1/creators/{handle}` | public | | Returns `{creator, isFollowing}` |
| GET | `/v1/creators/{handle}/videos` | public | `limit`, `offset` | Published videos for creator |
| GET | `/v1/talent` | public | `skills`, `q`, `limit`, `offset` | Searchable directory of builders |
| GET | `/v1/jobs` | public | `skills`, `q`, `remote`, `limit`, `offset` | Open job postings |
| GET | `/v1/jobs/{slug}` | public | | Single job details |
| GET | `/v1/stats` | public | | Aggregated platform statistics |

## Publishing

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/uploads` | session | `{contentType, sizeBytes}` → presigned PUT URL and key |
| POST | `/v1/videos` | session | `{storageKey, title, description, sessionMinutes, visibility, tags}` |
| POST | `/v1/videos/{id}/uploaded` | session | `{sizeBytes, checksumSha256?}` |
| POST | `/v1/videos/{id}/publish` | session | Transitions video to published |
| PATCH | `/v1/videos/{id}` | session | `{title?, description?, visibility?}` |
| DELETE | `/v1/videos/{id}` | session | Soft delete; sponsorship history survives |
| POST | `/v1/videos/{slug}/views` | public | Coarse deduplicated view recording |

The upload sequence is: request a URL, PUT the file to it, register the video
against the returned key, mark it uploaded, publish.

## Discussion

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| GET | `/v1/videos/{slug}/comments` | public | Threaded comments list |
| POST | `/v1/videos/{slug}/comments` | session | `{body, parentId?}` |
| DELETE | `/v1/comments/{id}` | session | Soft delete |
| POST | `/v1/comments/{id}/like` | session | Like comment |
| DELETE | `/v1/comments/{id}/like` | session | Unlike comment |

Replies are one level deep; a reply to a reply attaches to the top-level parent.

## Following

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/creators/{handle}/follow` | session | Follow creator |
| DELETE | `/v1/creators/{handle}/follow` | session | Unfollow creator |

## Sponsorship

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/sponsorships` | session | `{creatorHandle, videoId?, amount, message?, isAnonymous}` → `{payTo, intentId}` |
| POST | `/v1/sponsorships/{id}/signature` | session | `{signature, payer}` |
| POST | `/v1/sponsorships/{id}/confirm` | session | `{signature, payer, payee, amount}` |
| GET | `/v1/videos/{slug}/sponsors` | public | Top and recent sponsors for video |

The create call returns `payTo` — the address to send to. Confirm verifies
against the cluster; a 202 with `status: "pending"` means the transaction has
not finalized and the reconciler will settle it.

## Hiring

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/jobs` | session | Post a new job |
| POST | `/v1/jobs/{slug}/applications` | session | Apply for a job |
| GET | `/v1/jobs/{slug}/applications` | session | The client who posted the job |
| POST | `/v1/applications/{id}/status` | session | Update application status (`reviewing`, `accepted`, `rejected`) |

## Trust and safety

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| POST | `/v1/reports` | session | Report content or user; always 202, duplicates silent |

## Admin console

All admin endpoints require `admin` or `moderator` role. Actions modifying account status require `admin`.

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| GET | `/v1/admin/stats` | moderator/admin | Platform dashboard metrics |
| GET | `/v1/admin/health` | moderator/admin | System health and connection status |
| GET | `/v1/admin/users` | moderator/admin | `limit`, `offset` — list accounts with roles |
| GET | `/v1/admin/videos` | moderator/admin | `limit`, `offset` — list videos with moderation status |
| GET | `/v1/admin/jobs` | moderator/admin | `limit`, `offset` — list job postings |
| GET | `/v1/admin/reports` | moderator/admin | Moderation queue, oldest first |
| POST | `/v1/admin/reports/{id}/resolve` | moderator/admin | `{action, note?}` — hide, remove, warn, or suspend |
