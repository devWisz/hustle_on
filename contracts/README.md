# `hustleon_pay` — the sponsorship program

A Solana program that records sponsorships on chain and routes a platform fee to
a treasury. Deployed to devnet at:

```
6vK2BUb6UoAqTxWVU2zXTLDje8NDuVA8CaEuTwJZDkFk
```

The API verifies sponsorships against this program whenever
`HUSTLEON_PAY_PROGRAM_ID` is set. Setting it is what changes a sponsorship from a
bare SOL transfer the API watches, into a transaction with an on-chain receipt
anybody can read.

## Why a program at all

A plain transfer already moves the money, and the API already reads the balance
delta back from the cluster to confirm it. What a plain transfer cannot do is
leave anything behind: there is no record on chain that the payment was a
sponsorship, no way to count sponsorships without trusting our database, and no
place to charge a fee that the sender cannot quietly avoid.

## Instructions

`initialize_config(fee_bps: u16)` — creates the `Config` PDA. Sets `admin` and
`treasury` to the signer. Rejects `fee_bps > 1000`.

`update_config(fee_bps: u16, treasury: Pubkey)` — admin only. The signer must be
`config.admin`.

`sponsor(amount_lamports: u64)` — the one the API verifies. Exactly one argument,
so the instruction data is `8-byte discriminator ‖ 8-byte little-endian u64`.
Accounts, in order:

| # | Account | Notes |
|---|---|---|
| 0 | `sponsor` | signer, mutable — the wallet paying |
| 1 | `creator` | the creator's plain wallet, not a PDA |
| 2 | `treasury` | must equal `config.treasury` or the program refuses |
| 3 | `config` | PDA, seeds `[b"config"]` |
| 4 | `creator_stats` | PDA, seeds `[b"creator", creator]`, created on first sponsorship |
| 5 | `system_program` | |

It computes `fee = amount_lamports * fee_bps / 10000`, transfers `amount - fee`
to the creator and `fee` to the treasury, then adds to `creator_stats` and emits
`SponsorshipEvent`. `amount_lamports` must be greater than zero.

Accounts 0 and 1 are the two the API's verification reads: it requires the
instruction to name this exact sponsor and this exact creator. Everything else is
enforced by the program itself, which is why the API does not re-derive the PDAs.

## Accounts

`Config` — `admin: Pubkey`, `treasury: Pubkey`, `fee_bps: u16`, `bump: u8`.

`CreatorStats` — `creator: Pubkey`, `total_lamports: u64`, `sponsor_count: u64`,
`last_sponsored_at: i64`, `bump: u8`. Readable by anyone; it is the on-chain
answer to "how much has this creator been backed".

## Building

```bash
cd contracts
anchor build
```

The build needs `cargo-build-sbf`, which ships with the Solana CLI. It produces
`target/deploy/hustleon_pay.so` and, on first run, the program keypair that fixes
the program id.

**Keep `target/deploy/hustleon_pay-keypair.json`.** It is the program's upgrade
authority. `target/` is gitignored, so it exists only on the machine that built
it — lose it and the program can never be upgraded, only abandoned and redeployed
under a new address.

## Deploying

```bash
scripts/deploy-program.sh --check   # report the cost, change nothing
scripts/deploy-program.sh           # build, deploy to devnet, write .env
```

Deploying costs about 1.6 SOL of rent for a 227 KB program, and briefly about
twice that while the buffer account carries the upload; the buffer is closed and
refunded when the deploy finishes. On devnet, get SOL from
<https://faucet.solana.com> — it needs a signed-in session and a captcha, so it
is the one step that cannot be scripted from here. The script prints the exact
faucet URL for the deployer wallet when the balance is short.

After deploying, `initialize_config` has to be called once to create the `Config`
PDA and set the treasury and fee; until it exists, every `sponsor` call fails.

## How the API verifies a sponsorship

`backend/internal/solana` fetches the finalized transaction and requires all of:

1. the transaction succeeded;
2. an instruction belongs to `HUSTLEON_PAY_PROGRAM_ID`, top-level or as a CPI;
3. its data is the `sponsor` discriminator followed by exactly eight bytes —
   `sha256("global:sponsor")[..8]`, derived in code rather than pasted in;
4. its account list names the donor at index 0 and the creator at index 1;
5. the encoded amount is at least the amount promised when the intent was made;
6. the creator's balance actually rose by at least the amount less the maximum
   permitted fee.

Points 2–5 are what stop a bare transfer or a foreign program being counted.
Point 6 is what stops a well-formed instruction with nothing behind it being
counted: the instruction says what was asked for, the balance says what happened.

When `HUSTLEON_PAY_PROGRAM_ID` is empty the API falls back to verifying a plain
transfer, which is correct but records nothing on chain. The fallback exists so a
fresh clone works before anything is deployed; it is not meant for production,
and `make preflight` warns when it is in use.
