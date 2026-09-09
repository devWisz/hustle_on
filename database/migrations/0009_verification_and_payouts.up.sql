-- Migration 0009: Verification, Creator Payouts & Talent Acquisition System
-- Designed for 3 core perspectives:
-- 1. Creator POV: Timelapse upload, proof-of-work submission, payout preferences & earnings
-- 2. Admin POV: Manual verification queue, compliance checklist, listing approval & audit log
-- 3. Hiring/Talent Acquisition POV: Milestone escrow contracts, proof validation & direct inquiries

-- Verification status state machine for timelapse submissions
CREATE TYPE verification_status AS ENUM (
    'draft',
    'pending_verification',
    'in_review',
    'revision_requested',
    'approved',
    'rejected'
);

-- Creator tier progression based on verified proof of work
CREATE TYPE creator_tier AS ENUM (
    'contributor',
    'verified_builder',
    'master_craftsman',
    'studio_lead'
);

-- Payout types and disbursement status
CREATE TYPE payout_type AS ENUM (
    'submission_bounty',
    'sponsorship',
    'license_royalty',
    'milestone_escrow'
);

CREATE TYPE payout_status AS ENUM (
    'pending',
    'queued',
    'processing',
    'completed',
    'failed'
);

-- Rejection reason classification codes for manual admin reviews
CREATE TYPE review_rejection_code AS ENUM (
    'static_screen_inactivity',
    'insufficient_proof_artifacts',
    'ai_generated_without_disclosure',
    'sensitive_data_or_keys_exposed',
    'copyrighted_audio_or_media',
    'low_resolution_or_corrupt_stream',
    'inappropriate_content',
    'other'
);

-- 1. Creator Profiles: Extended creator settings, payout methods, and verified metrics
CREATE TABLE IF NOT EXISTS creator_profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tier                    creator_tier NOT NULL DEFAULT 'contributor',
    primary_category        text NOT NULL DEFAULT 'Engineering',
    hourly_rate_usd         numeric(10,2) CHECK (hourly_rate_usd >= 0),
    total_verified_minutes  integer NOT NULL DEFAULT 0 CHECK (total_verified_minutes >= 0),
    total_earned_lamports   bigint NOT NULL DEFAULT 0 CHECK (total_earned_lamports >= 0),
    payout_wallet           text,
    payout_preference       text NOT NULL DEFAULT 'solana' CHECK (payout_preference IN ('solana', 'usdc', 'fiat_bank')),
    commercial_license_fee  numeric(10,2) DEFAULT 49.00 CHECK (commercial_license_fee >= 0),
    is_verified             boolean NOT NULL DEFAULT false,
    verified_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_profiles_tier_idx ON creator_profiles (tier, is_verified);
CREATE INDEX IF NOT EXISTS creator_profiles_category_idx ON creator_profiles (primary_category);

-- 2. Timelapse Submissions: Creator POV submission records with proof-of-work metadata
CREATE TABLE IF NOT EXISTS timelapse_submissions (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id                uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    creator_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                   text NOT NULL,
    category                text NOT NULL DEFAULT 'Software Development',
    work_summary            text NOT NULL,
    real_work_minutes       integer NOT NULL CHECK (real_work_minutes > 0),
    timelapse_duration_secs integer NOT NULL CHECK (timelapse_duration_secs > 0),
    speed_multiplier        integer NOT NULL DEFAULT 30 CHECK (speed_multiplier >= 1),
    
    -- Verifiable Proof Artifacts
    git_repo_url            text,
    git_commit_hash         text,
    git_pr_url              text,
    deliverable_url         text,
    tools_used              text[] NOT NULL DEFAULT '{}',
    
    -- Monetization Intent
    requested_bounty_usd    numeric(10,2) DEFAULT 0 CHECK (requested_bounty_usd >= 0),
    commercial_licensing    boolean NOT NULL DEFAULT true,
    
    -- Review state
    status                  verification_status NOT NULL DEFAULT 'pending_verification',
    submitted_at            timestamptz NOT NULL DEFAULT now(),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timelapse_submissions_status_idx ON timelapse_submissions (status, submitted_at ASC);
CREATE INDEX IF NOT EXISTS timelapse_submissions_creator_idx ON timelapse_submissions (creator_id, created_at DESC);

-- 3. Video Verifications: Admin POV manual verification logs and audit trail
CREATE TABLE IF NOT EXISTS video_verifications (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id               uuid NOT NULL REFERENCES timelapse_submissions(id) ON DELETE CASCADE,
    video_id                    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    reviewer_id                 uuid REFERENCES users(id) ON DELETE SET NULL,
    status                      verification_status NOT NULL,
    
    -- Manual Verification Checklist
    check_screen_authenticity   boolean NOT NULL DEFAULT false,
    check_proof_artifacts_match boolean NOT NULL DEFAULT false,
    check_no_sensitive_secrets  boolean NOT NULL DEFAULT false,
    check_framerate_and_clarity boolean NOT NULL DEFAULT false,
    check_originality           boolean NOT NULL DEFAULT false,
    
    -- Moderator Findings & Feedback
    rejection_reason            review_rejection_code,
    reviewer_notes              text,
    feedback_for_creator        text,
    
    -- Verified Rewards
    bounty_awarded_lamports     bigint DEFAULT 0 CHECK (bounty_awarded_lamports >= 0),
    bounty_awarded_usd          numeric(10,2) DEFAULT 0 CHECK (bounty_awarded_usd >= 0),
    
    reviewed_at                 timestamptz,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_verifications_submission_idx ON video_verifications (submission_id);
CREATE INDEX IF NOT EXISTS video_verifications_reviewer_idx ON video_verifications (reviewer_id, created_at DESC);

-- 4. Creator Payouts: On-chain or fiat disbursements
CREATE TABLE IF NOT EXISTS creator_payouts (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id           uuid REFERENCES timelapse_submissions(id) ON DELETE SET NULL,
    video_id                uuid REFERENCES videos(id) ON DELETE SET NULL,
    payout_type             payout_type NOT NULL,
    amount_lamports         bigint NOT NULL DEFAULT 0 CHECK (amount_lamports >= 0),
    amount_usd              numeric(12,2) NOT NULL CHECK (amount_usd >= 0),
    status                  payout_status NOT NULL DEFAULT 'pending',
    recipient_wallet        text NOT NULL,
    solana_tx_hash          text,
    failure_reason          text,
    initiated_at            timestamptz NOT NULL DEFAULT now(),
    settled_at              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_payouts_creator_idx ON creator_payouts (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_payouts_status_idx ON creator_payouts (status);

-- 5. Talent Inquiries: Client / Recruiter direct proposals
CREATE TABLE IF NOT EXISTS talent_inquiries (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    talent_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_title           text NOT NULL CHECK (length(project_title) BETWEEN 3 AND 150),
    project_description     text NOT NULL CHECK (length(project_description) >= 10),
    timeline_weeks          integer CHECK (timeline_weeks > 0),
    budget_usd              numeric(12,2) CHECK (budget_usd >= 0),
    requires_timelapse_proof boolean NOT NULL DEFAULT true,
    status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'converted_to_engagement')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_inquiries_client_idx ON talent_inquiries (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS talent_inquiries_talent_idx ON talent_inquiries (talent_id, created_at DESC);

-- Automated updated_at triggers
CREATE TRIGGER creator_profiles_updated_at BEFORE UPDATE ON creator_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER timelapse_submissions_updated_at BEFORE UPDATE ON timelapse_submissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER video_verifications_updated_at BEFORE UPDATE ON video_verifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER creator_payouts_updated_at BEFORE UPDATE ON creator_payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER talent_inquiries_updated_at BEFORE UPDATE ON talent_inquiries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
