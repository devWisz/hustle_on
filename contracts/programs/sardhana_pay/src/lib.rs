//! Sardhana on-chain payments.
//!
//! Two flows live here:
//!
//! * **Sponsorship** — a one-shot transfer from a supporter to a creator, with
//!   the platform fee split off in the same transaction.
//! * **Hire escrow** — a client funds an engagement up front; milestones are
//!   released to the talent as work is delivered, and anything unreleased
//!   returns to the client after the deadline.
//!
//! The program holds no discretionary power over funds. It can pay the talent
//! (only on the client's signature), refund the client (only after expiry), and
//! take the configured fee (capped on chain at 10%). There is no instruction
//! that lets the authority move somebody else's money.

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Sard1111111111111111111111111111111111111111");

#[program]
pub mod sardhana_pay {
    use super::*;

    /// Creates the singleton config account.
    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
        instructions::admin::initialize_config(ctx, fee_bps)
    }

    /// Updates the fee, the pause flag or the treasury.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        paused: Option<bool>,
    ) -> Result<()> {
        instructions::admin::update_config(ctx, fee_bps, paused)
    }

    /// Sponsors a creator directly.
    pub fn sponsor(ctx: Context<Sponsor>, amount: u64, memo_hash: [u8; 32]) -> Result<()> {
        instructions::sponsor::sponsor(ctx, amount, memo_hash)
    }

    /// Opens and funds an escrowed engagement.
    pub fn create_engagement(
        ctx: Context<CreateEngagement>,
        engagement_id: u64,
        amount: u64,
        milestone_count: u8,
        expires_at: i64,
    ) -> Result<()> {
        instructions::escrow::create_engagement(ctx, engagement_id, amount, milestone_count, expires_at)
    }

    /// Releases one milestone to the talent.
    pub fn release_milestone(
        ctx: Context<ReleaseMilestone>,
        milestone: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::escrow::release_milestone(ctx, milestone, amount)
    }

    /// Refunds the unreleased balance to the client after expiry.
    pub fn refund_engagement(ctx: Context<RefundEngagement>) -> Result<()> {
        instructions::escrow::refund_engagement(ctx)
    }
}
