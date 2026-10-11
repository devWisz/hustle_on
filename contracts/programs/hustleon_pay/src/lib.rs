
use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

// The address the keypair at target/deploy/hustleon_pay-keypair.json (and its
// backup in .keys/) fixes, and the one Anchor.toml, the IDL and every document
// here name. If this drifts from that keypair the program still deploys, but every
// PDA it derives is computed from the wrong program id and each instruction fails
// its seeds constraint — a failure that looks like a client bug and is not one.
declare_id!("6vK2BUb6UoAqTxWVU2zXTLDje8NDuVA8CaEuTwJZDkFk");

/// Hard ceiling on the platform fee: 1000 bps == 10%.
pub const MAX_FEE_BPS: u16 = 1_000;

/// Denominator for basis points.
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod hustleon_pay {
    use super::*;

    /// Creates the singleton `Config` PDA. `admin` and `treasury` are both set
    /// to the signer.
    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, HustleonPayError::InvalidFeeBps);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.admin.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;

        Ok(())
    }

    /// Admin-only update of the fee and the treasury wallet.
    pub fn update_config(ctx: Context<UpdateConfig>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, HustleonPayError::InvalidFeeBps);

        let config = &mut ctx.accounts.config;
        config.fee_bps = fee_bps;
        config.treasury = treasury;

        Ok(())
    }

    /// Sponsor a creator.
    ///
    /// Accounts (exact order):
    /// 0. `sponsor`        — signer, writable, pays the lamports + rent
    /// 1. `creator`        — writable, unchecked: a plain wallet, **not** a PDA
    /// 2. `treasury`       — writable, must equal `config.treasury`
    /// 3. `config`         — PDA `[b"config"]`
    /// 4. `creator_stats`  — PDA `[b"creator", creator]`, init_if_needed
    /// 5. `system_program`
    ///
    /// Args: `amount_lamports: u64` — and nothing else.
    pub fn sponsor(ctx: Context<Sponsor>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, HustleonPayError::ZeroAmount);

        let fee_bps = ctx.accounts.config.fee_bps as u128;
        let amount = amount_lamports as u128;

        // fee = amount * fee_bps / 10000  (u128 intermediate: the result is
        // identical to u64 math for every non-overflowing input).
        let fee: u64 = (amount * fee_bps / BPS_DENOMINATOR as u128) as u64;
        let creator_share: u64 = amount_lamports
            .checked_sub(fee)
            .ok_or(HustleonPayError::MathOverflow)?;

        // 1. Pay the creator their share.
        if creator_share > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.sponsor.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                ),
                creator_share,
            )?;
        }

        // 2. Route the platform fee to the treasury.
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.sponsor.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // 3. Record the sponsorship.
        let unix_timestamp = Clock::get()?.unix_timestamp;
        let creator_key = ctx.accounts.creator.key();

        let stats = &mut ctx.accounts.creator_stats;
        stats.creator = creator_key;
        stats.total_lamports = stats
            .total_lamports
            .checked_add(amount_lamports)
            .ok_or(HustleonPayError::MathOverflow)?;
        stats.sponsor_count = stats
            .sponsor_count
            .checked_add(1)
            .ok_or(HustleonPayError::MathOverflow)?;
        stats.last_sponsored_at = unix_timestamp;

        emit!(SponsorshipEvent {
            sponsor: ctx.accounts.sponsor.key(),
            creator: creator_key,
            amount_lamports,
            fee_lamports: fee,
            unix_timestamp,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Platform configuration. PDA: `[b"config"]`.
#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl Config {
    /// 8 (discriminator) + 32 + 32 + 2 + 1
    pub const LEN: usize = 8 + 32 + 32 + 2 + 1;
}

/// Per-creator sponsorship record. PDA: `[b"creator", creator]`.
#[account]
pub struct CreatorStats {
    pub creator: Pubkey,
    pub total_lamports: u64,
    pub sponsor_count: u64,
    pub last_sponsored_at: i64,
    pub bump: u8,
}

impl CreatorStats {
    /// 8 (discriminator) + 32 + 8 + 8 + 8 + 1
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct SponsorshipEvent {
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub amount_lamports: u64,
    pub fee_lamports: u64,
    pub unix_timestamp: i64,
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    /// Becomes both `config.admin` and `config.treasury`.
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ HustleonPayError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct Sponsor<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// The creator's plain wallet — a system account, not a PDA.
    /// CHECK: only used as a lamport destination; never deserialized.
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    /// The platform treasury. Pinned to `config.treasury` so a sponsor cannot
    /// silently redirect the fee to an arbitrary wallet.
    /// CHECK: only used as a lamport destination; never deserialized.
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ HustleonPayError::Unauthorized
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = sponsor,
        space = CreatorStats::LEN,
        seeds = [b"creator", creator.key().as_ref()],
        bump
    )]
    pub creator_stats: Account<'info, CreatorStats>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum HustleonPayError {
    #[msg("fee_bps exceeds the maximum allowed platform fee (1000 bps / 10%)")]
    InvalidFeeBps,
    #[msg("amount_lamports must be greater than zero")]
    ZeroAmount,
    #[msg("signer is not authorized to perform this action")]
    Unauthorized,
    #[msg("arithmetic overflow")]
    MathOverflow,
}
