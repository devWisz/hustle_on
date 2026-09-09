# Payments

A donation is a plain SOL transfer from the donor's wallet to the creator's.
There is no on-chain program, no escrow, no platform fee, and no custody.
Sardhana's only role is to know which address to send to and to check afterwards
that the transfer really happened.

## The flow

```
POST /v1/donations                  intent: recipient and amount fixed by the server
      ▼
wallet signs and broadcasts         the browser talks to the chain, not to us
      ▼
POST /v1/donations/{id}/confirm     signature handed back
      ▼
solana.VerifyTransfer               transaction re-read at finalized commitment
      ▼
status = 'confirmed'                counters credited in one transaction
```

## Why the intent comes first

The recipient is read from the creator's verified `payout_address`, never from
the request. The amount is fixed at the same moment. Both are stored before
anything is signed.

That ordering is what makes the confirmation meaningful: it compares the chain
against numbers the client did not get to choose after the fact. Without it,
"confirm this signature for this amount to this address" would be a claim the
API had no independent basis to check.

## What verification actually checks

`backend/internal/solana/client.go` reads the transaction back and inspects the
**balance deltas** in the transaction meta:

- The transaction did not fail on chain.
- The recipient's balance rose by at least the promised lamports.
- The payer's balance fell.

It does not decode instructions and it does not read logs. The delta is what
actually happened; a transaction that emits convincing logs and transfers
nothing fails here. Requiring the payer to be out of pocket means a transfer
credited from some third account is not the transfer that was claimed.

Commitment is `finalized`, not `confirmed`. Money is only credited once the
transaction can no longer be rolled back by a fork.

## Nothing is credited twice

`donations.signature` is `UNIQUE`. A transaction already recorded against
another intent is rejected by the database, below the code that tried.

`ConfirmDonation` moves the status and both counters in a single transaction,
with `status = 'submitted'` in the predicate. A retried confirmation of the same
row updates nothing, so a network retry cannot double a total.

## Nothing is lost

`worker.SettleDonations` sweeps every two minutes for intents that were signed
but never confirmed back to us — the donor closed the tab, the request failed,
the RPC was down. It verifies them the same way and credits them late. Intents
that never received a signature are written off after thirty minutes.

This is why `confirm` answers `202` rather than an error when the RPC is
unreachable: the chain is unreachable, not wrong, and the money may well have
moved. Telling a donor their donation failed at that moment would be a lie.

## Responses

| Situation | Status | Meaning |
| --- | --- | --- |
| Verified | `200 confirmed` | Credited |
| Not finalized yet | `202 submitted` | Retry in a moment |
| RPC unreachable | `202 submitted` | The settle worker will finish it |
| Failed or mismatched | `400`, marked `failed` | It will never settle |
| Signature not valid base58 | `422` | Caught at the edge |
| Signature already recorded | `409` | — |

## Configuration

```bash
SOLANA_CLUSTER=devnet                        # mainnet-beta is required in production
SOLANA_RPC_URL=https://api.devnet.solana.com
```

That is the entire payment configuration. There is no program id, no treasury
address and no fee, because there is nothing between the two wallets.

The cluster is shown in the site footer on every page. Which chain real money
settles on is not a detail to bury.

## What the platform cannot do

It holds no private key, so it cannot move anyone's SOL. It cannot reverse a
confirmed transaction — nobody can. It cannot redirect a donation, because the
recipient comes from an address the creator proved they control.

If the API is compromised, an attacker can lie about what is displayed. They
cannot take the money, because it never passes through here.
