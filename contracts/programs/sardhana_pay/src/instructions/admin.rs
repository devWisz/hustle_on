use anchor_lang::prelude::*;

use crate::errors::SardhanaError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: only its address is stored; the program never reads or writes it here.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, SardhanaError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.treasury.key();
    config.fee_bps = fee_bps;
    config.paused = false;
    config.bump = ctx.bumps.config;

    msg!("config initialised with fee {} bps", fee_bps);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        // Only the recorded authority may change settings. Anchor enforces
        // this before the handler body runs.
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,

    /// CHECK: optional new treasury; only its address is stored.
    pub new_treasury: Option<UncheckedAccount<'info>>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    paused: Option<bool>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(bps) = fee_bps {
        require!(bps <= MAX_FEE_BPS, SardhanaError::FeeTooHigh);
        config.fee_bps = bps;
    }
    if let Some(p) = paused {
        config.paused = p;
    }
    if let Some(treasury) = &ctx.accounts.new_treasury {
        config.treasury = treasury.key();
    }
    Ok(())
}
