# HustlerOn Database Architecture & Perspective Schema

This document details the relational schema designed around three core product perspectives:
1. **Creator / Uploader Perspective**: Recording timelapses, submitting proof-of-work, and receiving automated payouts (bounties, sponsorships, licenses).
2. **Admin / Moderator Perspective**: Manual verification queue, compliance checklists, audit trail, and listing approvals.
3. **Talent Acquisition / Hiring Perspective**: Browsing verified proof, escrow-funded milestone engagements, and talent proposals.

---

## Architecture Overview

```
                      +-------------------+
                      |       users       |
                      +---------+---------+
                                |
        +-----------------------+-----------------------+
        | 1:1                   | 1:N                   | 1:N
+-------v---------+     +-------v---------+     +-------v---------+
| creator_profiles|     |     videos      |     |  engagements    |
| (payout config, |     | (playback,      |     | (milestone      |
| verified stats) |     |  metadata)      |     |  escrow)        |
+-----------------+     +-------+---------+     +-------+---------+
                                | 1:1                   | 1:N
                        +-------v-----------+   +-------v----------------+
                        |timelapse_         |   |engagement_milestones   |
                        |submissions        |   |(proof_video_id)        |
                        +-------+-----------+   +------------------------+
                                | 1:N
                        +-------v-----------+
                        |video_verifications|
                        |(admin checklist & |
                        | audit log)        |
                        +-------+-----------+
                                | triggers
                        +-------v-----------+
                        | creator_payouts   |
                        |(bounties/escrow)  |
                        +-------------------+
```

---

## 1. Creator / Uploader Perspective

### `creator_profiles`
Stores builder credentials, verified build hours, payout destination, and monetization preferences.
- `user_id` (UUID, PK/FK): References `users(id)`.
- `tier` (ENUM): `contributor` | `verified_builder` | `master_craftsman` | `studio_lead`.
- `primary_category` (TEXT): Engineering, Smart Contracts, UI/UX, 3D/VFX, DevOps.
- `hourly_rate_usd` (NUMERIC): Public rate for custom client engagements.
- `total_verified_minutes` (INTEGER): Sum of verified work minutes approved by moderation.
- `total_earned_lamports` (BIGINT): Total platform earnings in SOL/lamports.
- `payout_wallet` (TEXT): Destination Solana public key for automated bounty payouts.
- `payout_preference` (TEXT): `solana`, `usdc`, or `fiat_bank`.
- `commercial_license_fee` (NUMERIC): Standard per-session licensing fee for agencies/studios.
- `is_verified` (BOOLEAN): Platform proof-of-work badge.

### `timelapse_submissions`
Created when a user submits a timelapse to get paid and get listed.
- `id` (UUID, PK): Unique submission identifier.
- `video_id` (UUID, FK): References raw uploaded `videos(id)`.
- `creator_id` (UUID, FK): References `users(id)`.
- `real_work_minutes` (INTEGER): Total real time worked (e.g., 390 mins = 6.5 hrs).
- `timelapse_duration_secs` (INTEGER): Final compressed video duration (e.g., 240 secs).
- `speed_multiplier` (INTEGER): Speed factor (e.g., 60x).
- `git_repo_url`, `git_commit_hash`, `git_pr_url`: Verifiable VCS evidence.
- `deliverable_url`: Link to staging site, Figma file, or live contract.
- `tools_used` (TEXT[]): e.g. `{"Rust", "Solana Anchor", "Neovim", "Docker"}`.
- `requested_bounty_usd`: Target reward tier requested.
- `status`: `draft` -> `pending_verification` -> `in_review` -> `approved` / `rejected` / `revision_requested`.

---

## 2. Admin Verification Perspective

### `video_verifications`
Audit trail of manual inspections conducted by moderators prior to listing.
- `id` (UUID, PK): Review record.
- `submission_id` (UUID, FK): References `timelapse_submissions(id)`.
- `video_id` (UUID, FK): References `videos(id)`.
- `reviewer_id` (UUID, FK): Administrator/moderator `users(id)`.
- `status` (ENUM): `approved`, `rejected`, `revision_requested`.
- **Quality Checklist**:
  - `check_screen_authenticity`: True if active continuous work is detected (no idle loops or simulated loops).
  - `check_proof_artifacts_match`: True if the code shown on screen matches the linked Git commits or Figma boards.
  - `check_no_sensitive_secrets`: True if credentials, private keys, `.env` files, or proprietary secrets are clean.
  - `check_framerate_and_clarity`: Meets 1080p / 60fps pacing standards.
  - `check_originality`: Creator owns the copyright and original authorship.
- `rejection_reason` (ENUM): Structured taxonomy (`static_screen_inactivity`, `insufficient_proof_artifacts`, `ai_generated_without_disclosure`, `sensitive_data_or_keys_exposed`, etc.).
- `reviewer_notes` (TEXT): Internal moderator comments.
- `feedback_for_creator` (TEXT): Visible instructions sent to the creator.
- `bounty_awarded_lamports` (BIGINT): Bounty allocated upon approval.

---

## 3. Hiring & Talent Acquisition Perspective

### `jobs` & `job_applications`
Public opportunities posted by clients requiring verified timelapse deliverables.
- `jobs`: Includes `client_id`, `engagement` (fixed, hourly, milestone), `budget_min_usd`, `budget_max_usd`.
- `job_applications`: Includes `applicant_id`, `rate_usd`, and `portfolio_video_ids` (curated proof timelapses submitted as capability evidence).

### `engagements` & `engagement_milestones`
On-chain milestone escrows funded by clients and released to creators upon proof approval.
- `engagements`: `escrow_address` (Solana Program PDA), `total_amount`, `status`.
- `engagement_milestones`:
  - `position`: Milestone index (1, 2, 3...).
  - `amount`: Milestone payout locked in escrow.
  - `proof_video_id` (UUID, FK): Timelapse deliverable uploaded by the creator to prove milestone completion.
  - `released_at`: Timestamp when the client inspects proof and unlocks escrow funds.

### `talent_inquiries`
Direct 1-on-1 private contract inquiries initiated by recruiters browsing the verified creator catalog.
- `client_id`, `talent_id`, `project_title`, `project_description`, `timeline_weeks`, `budget_usd`, `status`.

---

## 4. Financial & Payout Settlement

### `creator_payouts`
Ledger of every financial transfer made to creators.
- `creator_id` (UUID, FK): Beneficiary.
- `payout_type`: `submission_bounty`, `sponsorship`, `license_royalty`, `milestone_escrow`.
- `amount_lamports` / `amount_usd`.
- `status`: `pending`, `queued`, `processing`, `completed`, `failed`.
- `recipient_wallet`: Solana address.
- `solana_tx_hash`: On-chain proof of settlement.
