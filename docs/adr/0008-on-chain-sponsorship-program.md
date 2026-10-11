# 8. Record sponsorships through an on-chain program

**Status:** accepted
**Supersedes:** [0007](0007-no-on-chain-program-for-donations.md)

## Context

[0007](0007-no-on-chain-program-for-donations.md) removed the escrow program and
made a donation a plain system transfer. That reasoning held while the platform
took no fee and nothing about a sponsorship needed to outlive the API's own
database: a transfer moves the money, and the API reads the balance delta back to
confirm it.

Two things changed. The platform now charges a fee, which a plain transfer gives
it no way to collect without an accounting step the sender can quietly avoid. And
a sponsorship that exists only as a row in our database is a claim about the chain
that the chain cannot confirm.

## Decision

Sponsorships go through a deployed Anchor program, `hustleon_pay`
(`6vK2BUb6UoAqTxWVU2zXTLDje8NDuVA8CaEuTwJZDkFk` on devnet), whenever
`HUSTLEON_PAY_PROGRAM_ID` is set. Its single `sponsor` instruction takes an
`amount_lamports`, pays the creator, routes a platform fee bounded at 1000 basis
points to a treasury, and emits an event. The API requires that instruction — from
that program, naming this donor and this creator — before it confirms anything,
and then checks that the creator's balance rose by at least the amount less the
maximum permitted fee.

With `HUSTLEON_PAY_PROGRAM_ID` empty the API still verifies a plain transfer. The
fallback exists so a fresh clone works before anything is deployed; it records
nothing on chain, and `make preflight` warns when it is in use.

## Consequences

Gained: every sponsorship has an on-chain receipt anyone can read, the fee is
enforced by the program rather than by an accounting step, and `CreatorStats`
answers "how much has this creator been backed" without trusting our database.

Accepted: a program to build, deploy, initialize and upgrade per cluster; a
treasury and a fee rate to administer; and one more thing that can be
misconfigured. 0007's concern — an audit surface for a transfer Solana already
performs — is now a cost the product has decided to pay. The API's verification is
what keeps that cost contained: it reads the program's own accounts and checks the
balance change, so a foreign program, or a well-formed instruction with nothing
behind it, counts for nothing.

Detail is in [contracts/README.md](../../contracts/README.md).
