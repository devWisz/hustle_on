# Payments

A donation is SOL moving from the donor's wallet to the creator's. Sponsorships go
through the deployed `hustleon_pay` program when `HUSTLEON_PAY_PROGRAM_ID` is set:
one `sponsor` instruction pays the creator, routes a platform fee to a treasury and
leaves an on-chain receipt. With the variable empty the API falls back to verifying
a plain SOL transfer. There is no escrow and no custody either way — the program
detail is in [contracts/README.md](../contracts/README.md).

Sponsoring requires an account. Both calls below answer `401` to a signed-out
caller, every intent records its donor, and only that donor can confirm it. The
watch page shows a signed-out visitor a prompt to sign in instead of the form,
and signing in returns them to the sponsor panel.

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

`backend/internal/solana/client.go` reads the transaction back at `finalized`
commitment.

With `HUSTLEON_PAY_PROGRAM_ID` set, it requires a `sponsor` instruction that
belongs to that program, names this donor and this creator, and encodes an amount
at least as large as the intent promised. Then it confirms the creator's balance
rose by at least the amount less the maximum permitted fee — the instruction says
what was asked for, the balance says what happened.

With the variable empty it verifies a plain transfer instead, inspecting the
**balance deltas** in the transaction meta:

- The transaction did not fail on chain.
- The recipient's balance rose by at least the promised lamports.
- The payer's balance fell.

It does not decode instructions and it does not read logs. The delta is what
actually happened; a transaction that emits convincing logs and transfers nothing
fails here. Requiring the payer to be out of pocket means a transfer credited from
some third account is not the transfer that was claimed.

Commitment is `finalized`, not `confirmed`. Money is only credited once the
transaction can no longer be rolled back by a fork. The fallback exists so a fresh
clone works before anything is deployed; it is not meant for production, and
`make preflight` warns when it is in use.

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
HUSTLEON_PAY_PROGRAM_ID=…                    # the deployed sponsorship program
```

The cluster and RPC endpoint are required. `HUSTLEON_PAY_PROGRAM_ID` is what
decides whether a sponsorship is recorded on chain or merely watched as a plain
transfer; the program's address, its fee and its treasury are documented in
[contracts/README.md](../contracts/README.md).

The cluster is shown in the site footer on every page. Which chain real money
settles on is not a detail to bury.

## What the platform cannot do

It holds no private key, so it cannot move anyone's SOL. It cannot reverse a
confirmed transaction — nobody can. It cannot redirect a donation, because the
recipient comes from an address the creator proved they control.

If the API is compromised, an attacker can lie about what is displayed. They
cannot take the money, because it never passes through here.

## When a donation has not appeared

A sponsor's money moves wallet to wallet; what this API decides is what it
believes happened on chain. Three things can be true when somebody says they paid
and cannot see it:

| What the chain says | What the ledger shows | What to do |
| --- | --- | --- |
| The transfer is finalized and matches | `Confirmed` | Nothing — the counters were credited by the confirmation |
| Not finalized yet | `Confirming` | Wait, or use **Re-check** on the row to ask again now |
| The transaction failed, or is not the one this intent promised | `Failed` | Nothing is credited, and the signature is retired so it cannot be offered again |

**Re-check** runs the same verification the donor's own confirmation runs. The
amount and the recipient come from the stored intent rather than from the request,
so an operator cannot credit a transfer the chain does not support — the button
shortens the wait for the settle loop, it does not bypass it.

The ledger also reports which cluster it verified against and whether the RPC
endpoint is answering, because every sponsorship depends on that endpoint and
nothing else on the site makes its failure visible.
