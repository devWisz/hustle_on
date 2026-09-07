use anchor_lang::prelude::*;

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
