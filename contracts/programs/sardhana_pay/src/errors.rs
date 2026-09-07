use anchor_lang::prelude::*;

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
