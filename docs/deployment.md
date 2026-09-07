# Deployment

## Environments

| Environment | Database | Cluster | Notes |
| ----------- | -------- | ------- | ----- |
| development | Neon branch per developer | devnet | Login links printed to the log |
| preview | Neon branch per pull request | devnet | Created and destroyed by CI |
| staging | `staging` branch | devnet | Mirrors production configuration |
| production | `main` branch | mainnet-beta | |

## What production refuses to start without

`config.Load` fails fast rather than degrading, so a missing variable cannot
quietly weaken a deployment. In production it requires `RESEND_API_KEY`, an
https `WEB_PUBLIC_URL`, object storage credentials, and
`SOLANA_CLUSTER=mainnet-beta`. `SESSION_SECRET` must be at least 32 bytes in
every environment.

## Secrets

Generate with `scripts/gen-secrets.sh` and store them in the platform's secret
manager. Never in the repository, never in a build argument, never in an image
layer. Rotating `SESSION_SECRET` invalidates every session and every CSRF
token, which signs everyone out — acceptable in an incident, disruptive
otherwise.

## Release order

Deploy in the order that keeps old and new code both working:

1. **Migrations** — additive only, against the direct (unpooled) endpoint.
2. **Backend** — the new binary, which writes both old and new shapes.
3. **Frontends** — they can only call what the API already serves.
4. **Cleanup migration** — dropping the old column, in a later release.

The program is separate. Deploying it changes the id in `Anchor.toml`,
`declare_id!`, `SOLANA_PROGRAM_ID` and `NEXT_PUBLIC_PROGRAM_ID`; all four must
agree, and clients must be redeployed with the new id.

## Backend

`backend/Dockerfile` builds a static binary into a distroless non-root image.
It copies both module roots because the auth module is referenced by a `replace`
directive.

Point the platform's health check at `/health/ready`, which verifies the
database, not `/health`, which only proves the process is alive.

## Frontends

Both are standard Next.js applications. Set `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SITE_URL` and the Solana variables at build time — they are
inlined into the bundle, so only non-secret values belong there.

Put the admin console behind whatever access control the organisation already
has: a VPN, an identity-aware proxy or an IP allow list. The API's role check
is the authorisation boundary; network restriction is depth on top of it.

## Behind a proxy

Set `TRUST_PROXY_HEADERS=true` **only** when a proxy you control sets
`X-Forwarded-For`. Trusting it on a directly-reachable service lets any client
spoof their address and evade every per-address limit.

## Rollback

Backend and frontends roll back by redeploying the previous image. Migrations
do not roll back automatically — apply the `.down.sql` deliberately, and only
after confirming no running version still writes the columns it drops.
