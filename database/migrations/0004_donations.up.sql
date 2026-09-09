-- Donations.
--
-- SOL moves directly from the donor's wallet to the creator's. This table is a
-- mirror of what the chain already settled, never the authority on it: a row
-- reaches 'confirmed' only after the API has fetched the transaction back from
-- an RPC node and checked that the recipient's balance genuinely rose.

CREATE TYPE donation_status AS ENUM (
    'pending',      -- intent recorded, the donor has not signed yet
    'submitted',    -- a signature was reported, not yet verified
    'confirmed',    -- read back from the chain and credited
    'failed'        -- the transaction failed, or never matched the intent
);

CREATE TABLE donations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timelapse_id    uuid NOT NULL REFERENCES timelapses(id) ON DELETE CASCADE,
    creator_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Signed-out visitors can donate, so the donor account is optional. The
    -- address is not: it is what the on-chain check is run against.
    donor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    donor_address   text NOT NULL CHECK (length(donor_address) BETWEEN 32 AND 44),
    -- The creator's address as it stood when the intent was created. Copied
    -- rather than joined, so a creator changing their wallet later cannot
    -- retroactively change where an earlier donation was supposed to land.
    payout_address  text NOT NULL CHECK (length(payout_address) BETWEEN 32 AND 44),

    amount_lamports bigint NOT NULL CHECK (amount_lamports > 0),
    message         text CHECK (length(message) <= 280),

    -- One row per signature: the uniqueness constraint is what stops the same
    -- transaction being submitted twice and credited twice.
    signature       text UNIQUE CHECK (length(signature) BETWEEN 64 AND 100),
    cluster         text NOT NULL,
    slot            bigint,
    status          donation_status NOT NULL DEFAULT 'pending',
    confirmed_at    timestamptz,
    -- What the RPC actually returned, kept so a disputed donation can be
    -- re-examined without another chain lookup.
    chain_meta      jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- Nobody donates to themselves; it would only inflate a public total.
    CHECK (donor_id IS NULL OR donor_id <> creator_id),
    -- Money is only ever counted as received alongside the evidence for it.
    CHECK (status <> 'confirmed' OR (signature IS NOT NULL AND confirmed_at IS NOT NULL))
);

-- The supporter list under a timelapse.
CREATE INDEX donations_timelapse_idx ON donations (timelapse_id, created_at DESC)
    WHERE status = 'confirmed';
-- A creator's received-donations view.
CREATE INDEX donations_creator_idx ON donations (creator_id, created_at DESC)
    WHERE status = 'confirmed';
-- Intents still waiting on a signature, for the sweep that expires them.
CREATE INDEX donations_open_idx ON donations (created_at)
    WHERE status IN ('pending', 'submitted');

CREATE TRIGGER donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
