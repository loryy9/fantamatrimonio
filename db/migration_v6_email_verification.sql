-- ============================================================
-- Migrazione v6: Codici di verifica email (OTP 6 cifre)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT        NOT NULL,
    code        VARCHAR(6)  NOT NULL,
    purpose     TEXT        NOT NULL DEFAULT 'registration', -- 'register_couple', 'register_account', 'upgrade_account'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes 
    ON email_verification_codes (email, code) 
    WHERE used_at IS NULL;
