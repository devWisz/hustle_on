-- Roll back migration 0009

DROP TRIGGER IF EXISTS talent_inquiries_updated_at ON talent_inquiries;
DROP TRIGGER IF EXISTS creator_payouts_updated_at ON creator_payouts;
DROP TRIGGER IF EXISTS video_verifications_updated_at ON video_verifications;
DROP TRIGGER IF EXISTS timelapse_submissions_updated_at ON timelapse_submissions;
DROP TRIGGER IF EXISTS creator_profiles_updated_at ON creator_profiles;

DROP TABLE IF EXISTS talent_inquiries;
DROP TABLE IF EXISTS creator_payouts;
DROP TABLE IF EXISTS video_verifications;
DROP TABLE IF EXISTS timelapse_submissions;
DROP TABLE IF EXISTS creator_profiles;

DROP TYPE IF EXISTS review_rejection_code;
DROP TYPE IF EXISTS payout_status;
DROP TYPE IF EXISTS payout_type;
DROP TYPE IF EXISTS creator_tier;
DROP TYPE IF EXISTS verification_status;
