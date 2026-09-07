use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::SardhanaError;
use crate::state::*;

#[event]
pub struct EngagementFunded {
    pub engagement: Pubkey,
    pub client: Pubkey,
    pub talent: Pubkey,
    pub amount: u64,
    pub milestone_count: u8,
    pub expires_at: i64,
}

#[event]
pub struct MilestoneReleased {
    pub engagement: Pubkey,
    pub talent: Pubkey,
    pub milestone: u8,
    pub amount: u64,
    pub fee: u64,
    pub remaining: u64,
}

#[event]
pub struct EngagementRefunded {
    pub engagement: Pubkey,
    pub client: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(engagement_id: u64)]
pub struct CreateEngagement<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = client,
        space = 8 + Engagement::INIT_SPACE,
        seeds = [ENGAGEMENT_SEED, client.key().as_ref(), &engagement_id.to_le_bytes()],
        bump
    )]
    pub engagement: Account<'info, Engagement>,

    /// Holds the escrowed lamports. A bare system account owned by a PDA, so
    /// only this program can move what is inside it.
    /// CHECK: PDA derived below; it holds lamports and carries no data.
    #[account(
        mut,
        seeds = [VAULT_SEED, engagement.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: the person being hired; recorded, and credited on release.
    pub talent: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Opens an engagement and funds it in one instruction.
///
/// Funding on creation is deliberate: an engagement that exists but is not yet
/// funded is a promise, and the point of escrow is that the talent does not
/// have to take a promise on trust.
pub fn create_engagement(
    ctx: Context<CreateEngagement>,
    engagement_id: u64,
    amount: u64,
    milestone_count: u8,
    expires_at: i64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, SardhanaError::ProgramPaused);
    require!(
        milestone_count >= 1 && milestone_count <= MAX_MILESTONES,
        SardhanaError::InvalidMilestoneCount
    );
    require!(amount > 0, SardhanaError::AmountTooSmall);

    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, SardhanaError::InvalidExpiry);

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.client.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let engagement = &mut ctx.accounts.engagement;
    engagement.client = ctx.accounts.client.key();
    engagement.talent = ctx.accounts.talent.key();
    engagement.engagement_id = engagement_id;
    engagement.total_lamports = amount;
    engagement.released_lamports = 0;
    engagement.milestone_count = milestone_count;
    engagement.released_mask = 0;
    engagement.expires_at = expires_at;
    engagement.status = EngagementStatus::Active;
    engagement.bump = ctx.bumps.engagement;
    engagement.vault_bump = ctx.bumps.vault;

    emit!(EngagementFunded {
        engagement: engagement.key(),
        client: engagement.client,
        talent: engagement.talent,
        amount,
        milestone_count,
        expires_at,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [ENGAGEMENT_SEED, client.key().as_ref(), &engagement.engagement_id.to_le_bytes()],
        bump = engagement.bump,
        has_one = client @ SardhanaError::NotTheClient,
        has_one = talent
    )]
    pub engagement: Account<'info, Engagement>,

    /// CHECK: PDA holding the escrowed lamports.
    #[account(
        mut,
        seeds = [VAULT_SEED, engagement.key().as_ref()],
        bump = engagement.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// Releasing is the client's decision, so the client signs.
    pub client: Signer<'info>,

    /// CHECK: paid on release; matched against the engagement by has_one.
    #[account(mut)]
    pub talent: UncheckedAccount<'info>,

    /// CHECK: constrained to the configured treasury.
    #[account(mut, address = config.treasury @ SardhanaError::WrongTreasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Releases one milestone's funds to the talent.
///
/// Lamports move by direct balance arithmetic rather than a system transfer,
/// because the vault is a PDA: the runtime lets a program debit an account it
/// owns, and a CPI transfer from a data-less PDA would need a signer seed for
/// an account the System Program does not own.
pub fn release_milestone(ctx: Context<ReleaseMilestone>, milestone: u8, amount: u64) -> Result<()> {
    let engagement = &mut ctx.accounts.engagement;

    require!(
        engagement.status == EngagementStatus::Active,
        SardhanaError::EngagementNotActive
    );
    require!(
        milestone < engagement.milestone_count,
        SardhanaError::InvalidMilestoneIndex
    );
    require!(
        !engagement.is_released(milestone),
        SardhanaError::MilestoneAlreadyReleased
    );
    require!(amount > 0, SardhanaError::AmountTooSmall);
    require!(
        amount <= engagement.remaining(),
        SardhanaError::InsufficientEscrow
    );

    let fee = (amount as u128)
        .checked_mul(ctx.accounts.config.fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(SardhanaError::MathOverflow)? as u64;
    let payout = amount.checked_sub(fee).ok_or(SardhanaError::MathOverflow)?;

    debit_vault(&ctx.accounts.vault, &ctx.accounts.talent, payout)?;
    if fee > 0 {
        debit_vault(&ctx.accounts.vault, &ctx.accounts.treasury, fee)?;
    }

    engagement.mark_released(milestone);
    engagement.released_lamports = engagement
        .released_lamports
        .checked_add(amount)
        .ok_or(SardhanaError::MathOverflow)?;
    if engagement.remaining() == 0 {
        engagement.status = EngagementStatus::Completed;
    }

    emit!(MilestoneReleased {
        engagement: engagement.key(),
        talent: engagement.talent,
        milestone,
        amount: payout,
        fee,
        remaining: engagement.remaining(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RefundEngagement<'info> {
    #[account(
        mut,
        seeds = [ENGAGEMENT_SEED, client.key().as_ref(), &engagement.engagement_id.to_le_bytes()],
        bump = engagement.bump,
        has_one = client @ SardhanaError::NotTheClient
    )]
    pub engagement: Account<'info, Engagement>,

    /// CHECK: PDA holding the escrowed lamports.
    #[account(
        mut,
        seeds = [VAULT_SEED, engagement.key().as_ref()],
        bump = engagement.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub client: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Returns whatever is left in escrow to the client, once the engagement has
/// expired. The deadline is what stops a client from pulling funds back out
/// from under work that is already underway.
pub fn refund_engagement(ctx: Context<RefundEngagement>) -> Result<()> {
    let engagement = &mut ctx.accounts.engagement;

    require!(
        engagement.status == EngagementStatus::Active,
        SardhanaError::EngagementNotActive
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now >= engagement.expires_at, SardhanaError::NotExpired);

    let remaining = engagement.remaining();
    require!(remaining > 0, SardhanaError::InsufficientEscrow);

    debit_vault(
        &ctx.accounts.vault,
        &ctx.accounts.client.to_account_info(),
        remaining,
    )?;

    engagement.released_lamports = engagement.total_lamports;
    engagement.status = EngagementStatus::Refunded;

    emit!(EngagementRefunded {
        engagement: engagement.key(),
        client: engagement.client,
        amount: remaining,
    });

    Ok(())
}

/// Moves lamports out of the program-owned vault.
///
/// The subtraction is checked, so a bug elsewhere cannot underflow the vault
/// into a huge balance, and the addition is checked so a recipient near u64::MAX
/// fails loudly rather than wrapping.
fn debit_vault<'info>(
    vault: &impl ToAccountInfo<'info>,
    recipient: &impl ToAccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let vault = vault.to_account_info();
    let recipient = recipient.to_account_info();

    let vault_balance = vault.lamports();
    let new_vault_balance = vault_balance
        .checked_sub(amount)
        .ok_or(SardhanaError::InsufficientEscrow)?;

    **vault.try_borrow_mut_lamports()? = new_vault_balance;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(SardhanaError::MathOverflow)?;

    Ok(())
}
