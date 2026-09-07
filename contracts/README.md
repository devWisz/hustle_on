# contracts

The Solana program behind Sardhana's payments, written with Anchor.

## What is on chain, and what is not

On chain: the movement of money and the rules that govern it — the fee split,
the escrow balance, which milestones have been paid, and when a refund becomes
available.

Off chain: everything else. Profiles, comments, video metadata and sponsorship
messages live in Postgres. Only a SHA-256 hash of a sponsorship message is
emitted, so a note can be tied to its transaction without publishing text on a
permanent public ledger.

## Instructions

| Instruction | Signer | Effect |
| ----------- | ------ | ------ |
| `initialize_config` | authority | Creates the singleton config PDA |
| `update_config` | authority | Changes fee, pause flag or treasury |
| `sponsor` | sponsor | Pays a creator, splitting the platform fee |
| `create_engagement` | client | Opens and funds an escrow |
| `release_milestone` | client | Pays one milestone to the talent |
| `refund_engagement` | client | Returns the unreleased balance after expiry |

## Accounts

```
config      PDA ["config"]                                    singleton settings
creator     PDA ["creator", creator]                          lifetime sponsorship totals
engagement  PDA ["engagement", client, engagement_id_le]      escrow state
vault       PDA ["vault", engagement]                         escrowed lamports
```

The vault is separate from the engagement state account on purpose. Funds and
state in one account means the rent-exempt minimum is entangled with the escrow
balance, and a withdrawal that empties the account deletes the state with it.

## Security properties

- **The fee is capped in the program.** `MAX_FEE_BPS` is 1000 (10%). A
  compromised authority can change the fee within that band and nothing more.
- **The treasury is pinned to config.** Both paying instructions constrain the
  treasury account with `address = config.treasury`, so a caller cannot pass
  their own account and collect the fee.
- **The authority cannot move user funds.** There is no instruction that
  transfers from a vault to the authority. Pausing stops new deposits; it never
  touches money already escrowed.
- **All arithmetic is checked**, and the release profile sets
  `overflow-checks = true`, so an overflow aborts rather than wrapping.
- **A milestone cannot be paid twice.** `released_mask` is a bitmap checked
  before every release.
- **A refund cannot front-run delivered work.** It is only available after
  `expires_at`.

## Working on it

```bash
anchor build
anchor test                       # spins up a local validator
anchor deploy --provider.cluster devnet
```

After deploying, put the program id in `Anchor.toml`, `declare_id!` and the
`SOLANA_PROGRAM_ID` / `NEXT_PUBLIC_PROGRAM_ID` environment variables. They must
all agree or clients will build instructions against the wrong program.

## Before mainnet

1. An external audit of `escrow.rs`, particularly `debit_vault`.
2. The upgrade authority moved to a multisig, then a published timelock.
3. `initialize_config` executed once, by that multisig, with the real treasury.
4. A dry run on devnet of the pause lever and the refund path.
