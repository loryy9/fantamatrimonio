-- ============================================================
-- Migrazione v8: login obbligatorio per tutti + login social
-- Esegui nell'SQL Editor di Neon.
-- ============================================================

-- Nickname facoltativo a livello di account (default per i nuovi eventi)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Identita' social collegate a un account (Google, Facebook)
CREATE TABLE IF NOT EXISTS account_identities (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider         TEXT        NOT NULL CHECK (provider IN ('google', 'facebook')),
    provider_user_id TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_identities_account ON account_identities (account_id);
