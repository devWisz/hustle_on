# 7. No on-chain program for donations

**Status:** accepted

## Context

An earlier design routed donations through an Anchor program that split a
platform fee between the creator and a treasury, and also held escrow for hired
work. The hiring feature has been removed, and the platform takes no fee.

What remains is: move SOL from one wallet to another.

Keeping the program would mean maintaining a Rust workspace, an upgrade
authority, a deployment step per cluster, and an audit surface — in order to
perform a transfer that Solana's system program already performs.

## Decision

A donation is a plain system transfer from the donor's wallet to the creator's
verified payout address. There is no program, no fee and no custody.

The API's role is to fix the recipient and the amount *before* anything is
signed, and afterwards to read the transaction back from an RPC node at
`finalized` commitment and check that the balances actually moved. See
[0003](0003-verify-payments-against-the-chain.md) for why that verification is
done against balance deltas rather than logs.

## Consequences

The platform holds no key that can move anyone's money. An attacker with full
control of the API can lie about what the site displays; they cannot take the
funds, because funds never pass through it.

There is nothing to deploy or upgrade on chain, and no program-level bug class
to audit.

The cost is that the platform cannot take a fee at settlement time, and cannot
offer escrow or refunds. Anything that needs value held between two parties
would need this decision revisited — and would deserve its own record, because
holding other people's money is a materially different product.
