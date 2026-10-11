# Workflow

The whole product is one path. A creator records a session, describes it, and
submits it; a person reads it and decides; if it is approved, viewers can watch
it and send SOL to the creator's wallet.

This document follows that path end to end and names the file that does each
step, so a change can be traced from the button to the row.

---

## The lifecycle

`timelapses.status` is the whole state machine, and the enum is declared in the
order a submission actually moves through it.

```
                 creator                         admin
                    │                              │
   draft ──────▶ uploaded ──────▶ in_review ──┬──▶ published
     ▲              │   submit                │        │
     │              │                         │        │ takedown
     └──── edit ────┴──── rejected ◀──────────┘        ▼
                          │  (with a written reason)  removed
                          └──▶ resubmit ──▶ in_review
```

Two properties matter more than the diagram:

- **`published` is only ever written by a review decision.** No creator action
  reaches it. `Approve` is the single statement in the codebase that sets it,
  and it is behind `requireAdmin`.
- **A row is never deleted.** Withdrawal sets `removed`, because donations
  reference the row and a supporter's record of what they funded must not
  vanish underneath them.

---

## 1. Recording and submitting

Frontend: `frontend/src/components/upload-form.tsx`

One form, four requests. It is not a wizard: everything on it is needed before
anyone can review the result, and splitting that over four screens only hides
how much is being asked for.

```
POST /v1/uploads              → { url, key, expiresAt, maxBytes }
PUT  <url>                      the bytes, straight to storage
POST /v1/timelapses           → the draft row
POST /v1/timelapses/{id}/uploaded
POST /v1/timelapses/{id}/submit
```

**Video never passes through the API.** `POST /v1/uploads` returns a presigned
`PUT` URL. The API controls the destination rather than the traffic: the object
key embeds the caller's own account id and the signature covers it, so editing
the URL into somebody else's prefix invalidates it. `media.OwnsKey` re-checks
the prefix before the key is ever attached to a row.

The content type is on a strict allowlist (`mp4`, `mov`, `webm`, `mkv`) and is
part of the signature. It is a security control, not metadata: an HTML file
accepted here and served from a bucket origin is stored cross-site scripting.

In development, with no bucket credentials configured, the API stores uploads on
disk under `backend/data/uploads` and serves them back. Those two routes are
registered **only** when `media.IsLocal()` — a production deployment does not
carry an unauthenticated write endpoint at all.

**What the creator must supply:**

| Field | Rule | Why |
| --- | --- | --- |
| `title` | 3–120 chars | — |
| `summary` | 40–4000 chars | The write-up is the substance of a submission. A review cannot mean anything without it, so the schema will not store a row without one. |
| `sessionMinutes` | 1–10080 | Real time spent, not clip length. This is the number people are funding. |
| `githubUrl` | optional, `github.com` only | Rendered as a link on a public page. A free-form URL field is how a submission form becomes somebody else's traffic funnel. |
| `xUrl` | optional, `x.com`/`twitter.com` only | Same. |

Both link fields are pinned by a regex in `validate` *and* by a `CHECK`
constraint in the schema, so a write that bypasses the API cannot store one
either.

---

## 2. Review

Frontend: `frontend/src/components/review-queue.tsx`
Backend: `backend/internal/server/admin_handlers.go`

```
GET    /v1/admin/queue                      oldest submission first
POST   /v1/admin/timelapses/{id}/approve
POST   /v1/admin/timelapses/{id}/reject     { note }
DELETE /v1/admin/timelapses/{id}            takedown after publication
```

The queue is ordered by `submitted_at ASC`: whoever has waited longest is next.

A reviewer sees the video, the write-up and the links together, because the
decision is whether those three describe the same piece of work. There is no
bulk action anywhere on the page — approving a list in one click is how
unchecked submissions reach a feed.

**A rejection requires a reason.** Minimum ten characters at the API, and
enforced again by the schema:

```sql
CHECK (status <> 'rejected' OR (reviewed_at IS NOT NULL AND review_note IS NOT NULL))
```

The note is shown to the creator on their dashboard, and only there — it is
stripped from every public payload by `redactForPublic`. A rejection the creator
cannot act on is worse than no answer.

**Resubmitting clears the previous decision.** `Submit` nulls `review_note`,
`reviewed_by` and `reviewed_at`, so a fresh attempt never carries a stale
rejection.

**Approval and the creator's count move together**, in one transaction. A
published row whose creator's count does not include it would be visibly wrong
on the profile it appears on.

Every decision writes an `audit_log` row with the actor, the subject and the
note. If that write fails it is logged but does not fail the request: the
decision has already been applied, and returning an error the reviewer cannot
act on would only invite them to apply it twice.

---

## 3. Watching

Frontend: `frontend/src/app/watch/[slug]/page.tsx`

A published timelapse is public. An unpublished one is visible to its creator
and to an admin, and returns **404** to everyone else — a submission waiting on
review should not be discoverable by guessing its slug.

Views are counted once per viewer per day, after five seconds of watching. A
bounce is not a view. Signed-out viewers are deduplicated by an HMAC of their
address salted with the date, so a refresh loop cannot inflate a counter and
today's token has no relationship to tomorrow's. The two `UNIQUE` indexes on
`timelapse_views` do the deduplication; the counter is only touched when the
insert was genuinely new.

---

## 4. Donating

Frontend: `frontend/src/components/donate-panel.tsx`
Backend: `backend/internal/server/donation_handlers.go`

SOL moves **wallet to wallet**. Hustle On never holds it and takes no cut. There
is no on-chain program to deploy — a donation is a plain system transfer.

```
POST /v1/donations                  { slug, donorAddress, amountLamports, message }
     │  server fixes the recipient and the amount, records the intent
     ▼
wallet.signAndSendTransaction(...)  → signature
     │
     ▼
POST /v1/donations/{id}/confirm     { signature }
     │  API fetches the finalized transaction from an RPC node
     │  and checks the balances actually moved
     ▼
donations.status = 'confirmed', counters credited
```

**The intent comes first, and that is the point.** The recipient is read from
the creator's verified `payout_address`, not from the request, so a tampered
page cannot redirect a donation. The amount is fixed at the same moment, so the
confirmation step compares the chain against a number the client did not get to
choose after the fact.

`payout_address` is copied onto the donation row rather than joined. A creator
changing their wallet later must not retroactively change where an earlier
donation was supposed to land.

**A signature is a claim, not evidence.** `solana.VerifyTransfer` reads the
transaction back at `finalized` commitment and checks the *balance deltas* in
the transaction meta — not decoded instructions, and not logs. The delta is what
actually happened; a transaction that emits convincing logs and transfers
nothing fails here. It also requires the payer's balance to have fallen, so a
transfer credited from a third account is not the transfer that was claimed.

**Nothing is credited twice.** `donations.signature` is `UNIQUE`, so a
transaction already recorded against another intent is rejected at the database.
`ConfirmDonation` moves the status and both counters in one transaction, with
`status = 'submitted'` in the predicate, so a retried request updates nothing.

### How each failure is answered

| Situation | Response | Reasoning |
| --- | --- | --- |
| Signature is not valid base58 | `422` | Bad input, caught at the edge — an RPC would answer with an opaque "invalid param" the API could only report as its own fault |
| Not finalized yet | `202 submitted` | Seconds early is not a failure; the client retries |
| Transaction failed, or does not match | `400`, intent marked `failed` | It will never settle |
| RPC unreachable | `202 submitted` | The chain is unreachable, not wrong. The money may well have moved; the settle loop finishes it |
| Signature already recorded | `409` | — |

**Nothing is lost if the donor closes the tab.** `worker.SettleDonations`
sweeps every two minutes for intents that were signed but never confirmed back
to us, verifies them the same way, and credits them late. Intents that never got
a signature are written off after thirty minutes.

---

## Where the money and the truth live

| Question | Authority |
| --- | --- |
| Did this transfer happen? | The Solana chain. Postgres mirrors it. |
| Who owns this payout address? | The keyholder, proven by signature. |
| Should this be public? | A person, recorded in `audit_log`. |
| What is a view? | One person, one timelapse, one day. |

Postgres records intent and a confirmed mirror of what the chain already
settled. It is never the authority on a balance.
