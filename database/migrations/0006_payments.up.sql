-- On-chain money. Postgres records intent and a confirmed mirror of what the
-- chain already settled; the chain remains the source of truth for balances.

CREATE TYPE payment_status AS ENUM (
    'pending',      -- intent created, no signature seen yet
    'submitted',    -- client reported a signature, not yet confirmed
    'confirmed',    -- verified against the RPC with the expected program logs
    'failed',
    'refunded'
);

CREATE TYPE payment_kind AS ENUM ('sponsorship', 'escrow_fund', 'escrow_release', 'refund');

-- Ledger of every transaction the platform has verified on chain.
CREATE TABLE onchain_transactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signature       text NOT NULL UNIQUE CHECK (length(signature) BETWEEN 64 AND 100),
    kind            payment_kind NOT NULL,
    cluster         text NOT NULL,
    slot            bigint,
    payer_address   text NOT NULL,
    payee_address   text,
    mint            text,                       -- NULL means native SOL
    amount          bigint NOT NULL CHECK (amount > 0),
    fee_amount      bigint NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    status          payment_status NOT NULL DEFAULT 'pending',
    confirmed_at    timestamptz,
    raw_meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX onchain_transactions_payer_idx ON onchain_transactions (payer_address, created_at DESC);
CREATE INDEX onchain_transactions_status_idx ON onchain_transactions (status)
    WHERE status IN ('pending', 'submitted');

CREATE TABLE sponsorships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
    creator_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id        uuid REFERENCES videos(id) ON DELETE SET NULL,
    transaction_id  uuid REFERENCES onchain_transactions(id) ON DELETE SET NULL,
    amount          bigint NOT NULL CHECK (amount > 0),
    mint            text,
    message         text CHECK (length(message) <= 280),
    is_anonymous    boolean NOT NULL DEFAULT false,
    status          payment_status NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (sponsor_id IS DISTINCT FROM creator_id)
);

CREATE INDEX sponsorships_creator_idx ON sponsorships (creator_id, created_at DESC)
    WHERE status = 'confirmed';
CREATE INDEX sponsorships_video_idx ON sponsorships (video_id, created_at DESC);
CREATE INDEX sponsorships_sponsor_idx ON sponsorships (sponsor_id, created_at DESC);

CREATE TRIGGER onchain_transactions_updated_at BEFORE UPDATE ON onchain_transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sponsorships_updated_at BEFORE UPDATE ON sponsorships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
