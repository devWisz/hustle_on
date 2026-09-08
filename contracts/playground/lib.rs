// Sardhana Pay - single-file build for Solana Playground (beta.solpg.io).
//
// Paste this whole file over src/lib.rs in a new Anchor project, then Build
// and Deploy. Playground rewrites declare_id! with its own program keypair,
// so leave the placeholder below alone - the deployed program id is what
// Playground shows after "Deploy", and that is the value to copy back.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("11111111111111111111111111111111");

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum SardhanaError {
    #[msg("The platform fee cannot exceed 10%.")]
    FeeTooHigh,
    #[msg("The program is paused; new payments are not being accepted.")]
    ProgramPaused,
    #[msg("Sponsorship amount is below the minimum.")]
    AmountTooSmall,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("A creator cannot sponsor themselves.")]
    SelfSponsorship,
    #[msg("Milestone count must be between 1 and 32.")]
    InvalidMilestoneCount,
    #[msg("That milestone index does not exist for this engagement.")]
    InvalidMilestoneIndex,
    #[msg("That milestone has already been released.")]
    MilestoneAlreadyReleased,
    #[msg("The release amount exceeds the balance still held in escrow.")]
    InsufficientEscrow,
    #[msg("This engagement is no longer active.")]
    EngagementNotActive,
    #[msg("This engagement has not expired yet.")]
    NotExpired,
    #[msg("The expiry must be in the future.")]
    InvalidExpiry,
    #[msg("Only the client who funded this engagement may do that.")]
    NotTheClient,
    #[msg("The treasury account does not match the configured treasury.")]
    WrongTreasury,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Platform-wide settings. One account, at a fixed PDA, so every instruction
/// reads the same fee and treasury and no caller can substitute their own.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// May update this account. Expected to be a multisig in production.
    pub authority: Pubkey,
    /// Receives the platform fee.
    pub treasury: Pubkey,
    /// Platform fee in basis points, capped at MAX_FEE_BPS.
    pub fee_bps: u16,
    /// When true, only refunds and releases are permitted. This is the lever
    /// to stop new money entering the program during an incident.
    pub paused: bool,
    pub bump: u8,
}

/// Running totals for one creator. Cheap to keep and it makes a creator's
/// earned history verifiable on chain rather than only in our database.
#[account]
#[derive(InitSpace)]
pub struct CreatorStats {
    pub creator: Pubkey,
    pub total_lamports: u64,
    pub sponsor_count: u64,
    pub bump: u8,
}

/// The state of one hire engagement.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace, Debug)]
pub enum EngagementStatus {
    /// Funded and in progress.
    Active,
    /// Every milestone has been released.
    Completed,
    /// Refunded to the client after expiry.
    Refunded,
}

/// An escrowed engagement between a client and a creator.
///
/// The lamports do not live here: they live in a separate vault PDA, which
/// keeps this account rent-exempt and its balance meaningful. Mixing state and
/// funds in one account is how a withdrawal accidentally takes the rent with it.
#[account]
#[derive(InitSpace)]
pub struct Engagement {
    pub client: Pubkey,
    pub talent: Pubkey,
    /// Client-chosen identifier, part of the PDA seeds.
    pub engagement_id: u64,
    /// Total escrowed at funding time.
    pub total_lamports: u64,
    /// Sum of everything released to the talent so far.
    pub released_lamports: u64,
    /// Number of milestones agreed.
    pub milestone_count: u8,
    /// Bitmap of released milestones; a milestone cannot be paid twice.
    pub released_mask: u32,
    /// Unix seconds after which an unreleased balance can be refunded.
    pub expires_at: i64,
    pub status: EngagementStatus,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Engagement {
    /// Lamports still held in escrow.
    pub fn remaining(&self) -> u64 {
        self.total_lamports.saturating_sub(self.released_lamports)
    }

    /// Whether a milestone index has already been paid.
    pub fn is_released(&self, index: u8) -> bool {
        self.released_mask & (1u32 << index) != 0
    }

    /// Marks a milestone paid.
    pub fn mark_released(&mut self, index: u8) {
        self.released_mask |= 1u32 << index;
    }
}

/// Seeds, kept in one place so the program and the clients cannot drift apart.
pub const CONFIG_SEED: &[u8] = b"config";
pub const CREATOR_SEED: &[u8] = b"creator";
pub const ENGAGEMENT_SEED: &[u8] = b"engagement";
pub const VAULT_SEED: &[u8] = b"vault";

/// The platform fee can never exceed 10%, enforced on chain rather than in the
/// admin console, so a compromised authority still cannot drain a payment.
pub const MAX_FEE_BPS: u16 = 1_000;

/// A milestone bitmap is 32 bits wide.
pub const MAX_MILESTONES: u8 = 32;

/// Refuses dust payments that would cost more in fees than they deliver.
pub const MIN_SPONSORSHIP_LAMPORTS: u64 = 1_000_000; // 0.001 SOL

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod sardhana_pay {
    use super::*;

    /// Creates the singleton config account.
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

    /// Updates the fee, the pause flag or the treasury.
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

    /// Sends a sponsorship, splitting the platform fee off in the same
    /// transaction.
    ///
    /// Both transfers happen here or neither does. Paying the creator and the
    /// fee in two separate transactions would leave a window where one
    /// succeeded and the other did not.
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

        // Checked arithmetic throughout: a fee computed by wrapping
        // multiplication could be made to round to zero, or worse.
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

        let creator_stats_info = &ctx.accounts.creator_stats;
        let bump = ctx.bumps.creator_stats;
        let mut stats = if creator_stats_info.data_is_empty() {
            let creator_key = ctx.accounts.creator.key();
            let signer_seeds: &[&[&[u8]]] = &[&[CREATOR_SEED, creator_key.as_ref(), &[bump]]];
            let space = 8 + CreatorStats::INIT_SPACE;
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(space);

            anchor_lang::system_program::create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::CreateAccount {
                        from: ctx.accounts.sponsor.to_account_info(),
                        to: creator_stats_info.to_account_info(),
                    },
                    signer_seeds,
                ),
                lamports,
                space as u64,
                &crate::ID,
            )?;

            CreatorStats {
                creator: ctx.accounts.creator.key(),
                total_lamports: 0,
                sponsor_count: 0,
                bump,
            }
        } else {
            require_keys_eq!(*creator_stats_info.owner, crate::ID);
            let mut data: &[u8] = &creator_stats_info.try_borrow_data()?;
            CreatorStats::try_deserialize(&mut data)?
        };

        stats.total_lamports = stats
            .total_lamports
            .checked_add(payout)
            .ok_or(SardhanaError::MathOverflow)?;
        stats.sponsor_count = stats
            .sponsor_count
            .checked_add(1)
            .ok_or(SardhanaError::MathOverflow)?;

        let mut data = creator_stats_info.try_borrow_mut_data()?;
        let mut writer = &mut data[..];
        stats.try_serialize(&mut writer)?;

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

    /// Opens an engagement and funds it in one instruction.
    ///
    /// Funding on creation is deliberate: an engagement that exists but is not
    /// yet funded is a promise, and the point of escrow is that the talent does
    /// not have to take a promise on trust.
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

    /// Releases one milestone's funds to the talent.
    ///
    /// Lamports move by direct balance arithmetic rather than a system
    /// transfer, because the vault is a PDA: the runtime lets a program debit
    /// an account it owns, and a CPI transfer from a data-less PDA would need a
    /// signer seed for an account the System Program does not own.
    pub fn release_milestone(
        ctx: Context<ReleaseMilestone>,
        milestone: u8,
        amount: u64,
    ) -> Result<()> {
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

    /// Returns whatever is left in escrow to the client, once the engagement
    /// has expired. The deadline is what stops a client from pulling funds back
    /// out from under work that is already underway.
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
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

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

#[derive(Accounts)]
pub struct Sponsor<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// CHECK: the recipient. It is only credited lamports, never read.
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    /// CHECK: PDA storing running totals for the creator. Initialised if needed.
    #[account(
        mut,
        seeds = [CREATOR_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_stats: UncheckedAccount<'info>,

    /// CHECK: constrained to the treasury recorded in config, so a caller
    /// cannot redirect the platform fee to an account of their choosing.
    #[account(mut, address = config.treasury @ SardhanaError::WrongTreasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
