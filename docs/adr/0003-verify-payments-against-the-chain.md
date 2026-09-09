# 3. Verify every payment against the chain before crediting

**Status:** accepted

## Context

Donations settle wallet-to-wallet, so the API is not in the payment path. It
learns that a payment happened from the client that made it. A client is not a
trustworthy narrator: a modified page can claim any signature, any amount, or a
transaction that failed.

## Decision

A reported signature is treated as a pointer, never as evidence. Before any
total moves, the API fetches the **finalized** transaction from an RPC endpoint
and checks the balance deltas in the transaction meta: the recipient gained at
least the expected lamports, and the payer's balance fell.

Balance deltas rather than instruction decoding, because the delta is what
actually happened — a transaction can emit convincing logs and transfer
nothing.

A background settle loop polls transactions that were submitted but never
confirmed, so a closed tab does not cost a creator their money. Both paths are
idempotent.

## Consequences

Accepted: crediting waits for finalization, which takes seconds rather than
being instant, and the platform depends on an RPC provider. A provider that
lags produces "pending" responses rather than wrong ones.

Gained: no forged credit is possible, double-crediting is structurally
prevented by the unique signature and the "not already confirmed" predicate, and
an interrupted flow still settles correctly.
