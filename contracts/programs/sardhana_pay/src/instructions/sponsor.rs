use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::SardhanaError;
use crate::state::*;

#[event]
pub struct SponsorshipMade {
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub fee: u64,
    /// SHA-256 of the off-chain message, so the note can be tied to this
    /// transaction without publishing its text on a permanent ledger.
    pub memo_hash: [u8; 32],
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct Sponsor<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// CHECK: the recipient. It is only credited lamports, never read.
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    /// Created on the creator's first sponsorship and reused afterwards.
    #[account(
        init_if_needed,
        payer = sponsor,
        space = 8 + CreatorStats::INIT_SPACE,
        seeds = [CREATOR_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_stats: Account<'info, CreatorStats>,

    /// CHECK: constrained to the treasury recorded in config, so a caller
    /// cannot redirect the platform fee to an account of their choosing.
    #[account(mut, address = config.treasury @ SardhanaError::WrongTreasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Sends a sponsorship, splitting the platform fee off in the same transaction.
///
/// Both transfers happen here or neither does. Paying the creator and the fee
/// in two separate transactions would leave a window where one succeeded and
/// the other did not.
pub fn sponsor(ctx: Context<Sponsor>, amount: u64, memo_hash: [u8; 32]) -> Result<()> {
    require!(!ctx.accounts.config.paused, SardhanaError::ProgramPaused);
    require!(
        amount >= MIN_SPONSORSHIP_LAMPORTS,
        SardhanaError::AmountTooSmall
    );
    require_keys_neq!(
        ctx.accounts.sponsor.key(),
        ctx.accounts.creator.key(),
        SardhanaError::SelfSponsorship
    );

    // Checked arithmetic throughout: a fee computed by wrapping multiplication
    // could be made to round to zero, or worse.
    let fee = (amount as u128)
        .checked_mul(ctx.accounts.config.fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(SardhanaError::MathOverflow)? as u64;
    let payout = amount.checked_sub(fee).ok_or(SardhanaError::MathOverflow)?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
        ),
        payout,
    )?;

    if fee > 0 {
        transfer(
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

    let stats = &mut ctx.accounts.creator_stats;
    stats.creator = ctx.accounts.creator.key();
    stats.bump = ctx.bumps.creator_stats;
    stats.total_lamports = stats
        .total_lamports
        .checked_add(payout)
        .ok_or(SardhanaError::MathOverflow)?;
    stats.sponsor_count = stats
        .sponsor_count
        .checked_add(1)
        .ok_or(SardhanaError::MathOverflow)?;

    emit!(SponsorshipMade {
        sponsor: ctx.accounts.sponsor.key(),
        creator: ctx.accounts.creator.key(),
        amount: payout,
        fee,
        memo_hash,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
