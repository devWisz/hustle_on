-- Hiring: public roles, applications, and milestone escrow mirrored from chain.

CREATE TYPE job_status AS ENUM ('draft', 'open', 'paused', 'filled', 'closed');
CREATE TYPE engagement_type AS ENUM ('fixed', 'hourly', 'milestone');
CREATE TYPE application_status AS ENUM ('submitted', 'shortlisted', 'rejected', 'accepted', 'withdrawn');
CREATE TYPE engagement_status AS ENUM ('proposed', 'funded', 'in_progress', 'delivered', 'released', 'disputed', 'cancelled');

CREATE TABLE jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug            text NOT NULL UNIQUE,
    title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
    description     text NOT NULL CHECK (length(description) BETWEEN 20 AND 10000),
    skills          text[] NOT NULL DEFAULT '{}',
    engagement      engagement_type NOT NULL DEFAULT 'fixed',
    budget_min_usd  numeric(12,2) CHECK (budget_min_usd >= 0),
    budget_max_usd  numeric(12,2) CHECK (budget_max_usd >= 0),
    is_remote       boolean NOT NULL DEFAULT true,
    location        text,
    status          job_status NOT NULL DEFAULT 'draft',
    application_count integer NOT NULL DEFAULT 0 CHECK (application_count >= 0),
    published_at    timestamptz,
    closes_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (budget_max_usd IS NULL OR budget_min_usd IS NULL OR budget_max_usd >= budget_min_usd)
);

CREATE INDEX jobs_open_idx ON jobs (published_at DESC) WHERE status = 'open';
CREATE INDEX jobs_client_idx ON jobs (client_id, created_at DESC);
CREATE INDEX jobs_skills_idx ON jobs USING gin (skills);

CREATE TABLE job_applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_note      text CHECK (length(cover_note) <= 3000),
    -- Timelapses the applicant is putting forward as evidence of the work.
    portfolio_video_ids uuid[] NOT NULL DEFAULT '{}',
    rate_usd        numeric(12,2) CHECK (rate_usd >= 0),
    status          application_status NOT NULL DEFAULT 'submitted',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, applicant_id)
);

CREATE INDEX job_applications_applicant_idx ON job_applications (applicant_id, created_at DESC);

CREATE TABLE engagements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid REFERENCES jobs(id) ON DELETE SET NULL,
    client_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    talent_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- PDA of the on-chain escrow account holding the funds.
    escrow_address  text UNIQUE,
    total_amount    bigint NOT NULL CHECK (total_amount > 0),
    mint            text,
    status          engagement_status NOT NULL DEFAULT 'proposed',
    terms           text CHECK (length(terms) <= 10000),
    starts_at       timestamptz,
    due_at          timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (client_id <> talent_id)
);

CREATE INDEX engagements_client_idx ON engagements (client_id, created_at DESC);
CREATE INDEX engagements_talent_idx ON engagements (talent_id, created_at DESC);

CREATE TABLE engagement_milestones (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    position        smallint NOT NULL CHECK (position >= 0),
    title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
    amount          bigint NOT NULL CHECK (amount > 0),
    -- Timelapse submitted as the deliverable for this milestone.
    proof_video_id  uuid REFERENCES videos(id) ON DELETE SET NULL,
    released_transaction_id uuid REFERENCES onchain_transactions(id) ON DELETE SET NULL,
    delivered_at    timestamptz,
    released_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (engagement_id, position)
);

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER job_applications_updated_at BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER engagements_updated_at BEFORE UPDATE ON engagements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER engagement_milestones_updated_at BEFORE UPDATE ON engagement_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
