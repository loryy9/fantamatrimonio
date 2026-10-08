-- ============================================================
-- Migrazione v5: sistema account + login sicuro
-- Esegui nell'SQL Editor di Neon sul database esistente.
-- ============================================================

-- 1. Tabella accounts: identità permanente cross-evento
--    Gli sposi la creano subito (email + password).
--    Gli ospiti possono "upgradarla" dopo la festa.
CREATE TABLE accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        UNIQUE,
    password_hash   TEXT,                    -- bcrypt hash, NULL per account non ancora registrati
    display_name    TEXT        NOT NULL,
    is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
    registered_at   TIMESTAMPTZ,             -- NULL = account non ancora registrato
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_email ON accounts (email);

-- 2. Collegamento users → accounts
--    Un account può avere più users (uno per evento a cui partecipa)
ALTER TABLE users ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_users_account_id ON users (account_id);

-- 3. Email opzionale sugli users (per il reminder post-festa)
--    Gli ospiti possono lasciare la loro email durante il login leggero.
ALTER TABLE users ADD COLUMN email TEXT;

-- 4. Tabella per le email di reminder post-festa
CREATE TABLE registration_reminders (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    send_after  TIMESTAMPTZ NOT NULL,
    sent_at     TIMESTAMPTZ,             -- NULL = non ancora inviata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_send_after ON registration_reminders (send_after)
    WHERE sent_at IS NULL;

-- 5. Sessioni per account (JWT-based, ma manteniamo anche session token per retrocompatibilità)
--    Il campo account_id è opzionale: se presente, la sessione è legata all'account.
ALTER TABLE sessions ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
