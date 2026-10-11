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

**Keep the program keypair.** It is the program's upgrade authority, and it lives
in two places, both gitignored: `target/deploy/hustleon_pay-keypair.json`, where
Anchor writes it, and `contracts/.keys/`, which survives `anchor clean` — because
`anchor clean` deletes `target/`, and a keypair that exists only there is one
stray command away from being lost. Lose it and the program can never be
upgraded, only abandoned and redeployed under a new address.

### The vendored `anchor-syn` patch

`contracts/patches/anchor-syn/` is upstream anchor-syn 0.30.1 with a single call
site changed in `src/idl/defined.rs` (`Span::source_file()` → `local_file()`), and
`Cargo.lock` pins `proc-macro2` at or above 1.0.95. Both are load-bearing.

Anchor 0.30.1 generates its IDL by running `cargo +nightly test
__anchor_private_print_idl` with `RUSTFLAGS=--cfg procmacro2_semver_exempt`, which
compiles an anchor-syn block calling `Span::source_file` — removed in proc-macro2
1.0.95. Without the patch the build stops at `Error: Building IDL failed`. Pinning
proc-macro2 *lower* does not help: 1.0.94 then fails inside proc-macro2 itself,
against the removed nightly `proc_macro::SourceFile` API.

If you would rather not vendor a patched crate, `anchor build --no-idl` skips only
the IDL step and produces the same program. Nothing here consumes the IDL — the
API derives the `sponsor` discriminator from the instruction name itself, and the
browser builds the instruction by hand — so the IDL exists for reference only.

## Deploying

```bash
scripts/deploy-program.sh --check   # report the cost, change nothing
scripts/deploy-program.sh           # build, deploy, initialize, verify, write .env
```

That one command does four things, in this order: builds, deploys, creates the
`Config` account, and reads both back off the cluster. The verification step
matters because "deployed" and "usable" are different states — a program can be
sitting on chain, fully executable, and unable to take a single sponsorship
because `Config` was never created (`sponsor` reads the fee from it).

Useful flags:

| flag | why |
|---|---|
| `--keypair <path>` | Pay from a funded keypair other than `~/.config/solana/id.json`. `ANCHOR_WALLET` does the same thing. |
| `--fee-bps <n>` | The platform fee, in basis points, max 1000 (10%). Default 500 (5%). |
| `--treasury <address>` | Where the fee goes. Defaults to the deploying wallet. |
| `--cluster mainnet-beta` | Deploy for real. |

The fee and the treasury are decided **once**, when `Config` is created. An
operator can change them afterwards with `update_config`, signed by the config
admin — but not by re-running the deploy, because the account already exists.

Deploying costs about 1.6 SOL of rent for a 227 KB program, and briefly about
twice that while the buffer account carries the upload; the buffer is closed and
refunded when the deploy finishes. On devnet, get SOL from
<https://faucet.solana.com> — it needs a signed-in session and a captcha, so it is
the one step that cannot be scripted. The script prints the exact faucet URL for
the wallet it is about to spend from when the balance is short. A failed
`solana airdrop` is almost always the faucet's per-IP allowance rather than
anything wrong here.

Check the state at any time, with or without the rest:

```bash
make program-check          # exit 0 only if a sponsorship would actually work
```

It reports whether the program is deployed and executable, whether `Config`
exists, and — if it does — the admin, treasury and fee recorded on chain. It exits
non-zero when something is missing, so it is safe to use as a gate.

The same state is visible to an operator in the console: `GET /v1/admin/chain`
reports `programId`, `programDeployed` and a plain-language summary, and the
ledger page shows it as a badge. A program address that is configured but has
nothing deployed at it is the state worth catching early — every sponsorship then
fails verification, and the failure looks exactly like a donor having sent the
wrong transaction.

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
