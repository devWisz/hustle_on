# Payments

Two flows: sponsorship, which is immediate, and hire escrow, which is staged.

## Sponsorship

```
sponsor          frontend            API                  chain
  │                 │                 │                     │
  │  amount, note   │                 │                     │
  ├────────────────▶│  POST /v1/sponsorships                │
  │                 ├────────────────▶│  intent: pending    │
  │                 │◀────────────────┤  payTo, amount      │
  │  wallet signs   │                 │                     │
  ├────────────────▶├─────────────────────────────────────▶ │  transfer
  │                 │◀───────────────────────────────────── │  signature
  │                 │  POST .../signature                   │
  │                 ├────────────────▶│  status: submitted  │
  │                 │  POST .../confirm                     │
  │                 ├────────────────▶│  getTransaction ───▶│
  │                 │                 │◀─── balances ───────│
  │                 │◀────────────────┤  status: confirmed  │
```

**The destination is the server's.** `payTo` comes from `wallets` in our
database. A client that could choose it could redirect money while showing the
creator's name.

**Verification reads balances, not logs.** `VerifyTransfer` requires the
finalized transaction, no `meta.err`, the recipient's balance up by at least
the expected lamports, and the payer's balance down. A transaction that emits
convincing logs but transfers nothing fails all of that.

**Nothing is credited before confirmation.** The intent row is `pending` until
the chain says otherwise, so an abandoned flow never touches a total.

**A closed tab is not a lost payment.** `ReconcilePayments` sweeps `submitted`
transactions every thirty seconds and settles them. Both paths are idempotent:
`ConfirmSponsorship` matches only rows not already confirmed.

**Failure is recorded.** A transaction that failed on chain marks the
sponsorship failed rather than leaving it pending forever.

## Hire escrow

Escrow lives entirely in the Anchor program.

1. **`create_engagement`** — the client funds a vault PDA in the same
   instruction that creates the engagement. An unfunded engagement is a
   promise, and escrow exists so the talent need not accept promises.
2. **`release_milestone`** — the client signs; the talent is paid, minus the
   fee. A bitmap makes a second release of the same milestone impossible.
3. **`refund_engagement`** — after `expires_at`, whatever is unreleased returns
   to the client. The deadline is what stops a client from pulling funds out
   from under work already underway.

The vault is a separate PDA from the engagement state. Combining them entangles
the rent-exempt minimum with the escrow balance, and a withdrawal that empties
the account would delete the state with it.

Postgres mirrors this in `engagements` and `engagement_milestones` for the
interface. The chain remains the source of truth for balances.

## Fees

The platform fee is basis points on each payment, split off in the same
transaction as the payout. `MAX_FEE_BPS` caps it at 10% in the program, and
both paying instructions constrain the treasury account to the one in config,
so a caller cannot collect the fee themselves.

## Amounts

Lamports, as integers, everywhere — in the API, the database (`bigint`) and the
program (`u64`). Floating point never touches a monetary value; SOL exists only
as a display format in `lib/format.ts`.
