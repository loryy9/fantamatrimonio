-- ============================================================
-- Fanta Matrimonio — Schema SQL Completo per Supabase
-- Da eseguire nell'SQL Editor di Supabase
-- Include tutte le tabelle, estensioni, indici e trigger aggiornati (v1 -> v6).
-- ============================================================

-- 1. Abilita estensione UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tipo ENUM per le tipologie di challenge
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_type') THEN
        CREATE TYPE challenge_type AS ENUM ('photo', 'hunt', 'vote', 'quiz');
    END IF;
END $$;

-- 3. Tabella: events (matrimoni indipendenti multi-tenant)
CREATE TABLE IF NOT EXISTS events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    spouse1_name  TEXT        NOT NULL,
    spouse2_name  TEXT        NOT NULL,
    enable_timer  BOOLEAN     NOT NULL DEFAULT FALSE,
    start_time    TIMESTAMPTZ,
    end_time      TIMESTAMPTZ,
    invite_code   TEXT        NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_invite_code ON events (invite_code);

-- 4. Tabella: accounts (identità permanente con login sicuro email + password)
CREATE TABLE IF NOT EXISTS accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        UNIQUE,
    password_hash   TEXT,                    -- bcrypt hash (NULL se non ancora registrato)
    display_name    TEXT        NOT NULL,
    is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
    registered_at   TIMESTAMPTZ,             -- NULL = account guest non ancora registrato
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email);

-- 5. Tabella: users (partecipazione del singolo utente all'evento specifico)
CREATE TABLE IF NOT EXISTS users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id   UUID        REFERENCES accounts(id) ON DELETE SET NULL,
    role         TEXT        NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'couple')),
    first_name   TEXT        NOT NULL,
    last_name    TEXT        NOT NULL,
    secret_word  TEXT        NOT NULL,
    email        TEXT,
    total_points INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_identity_per_event UNIQUE (event_id, first_name, last_name, secret_word)
);

CREATE INDEX IF NOT EXISTS idx_users_identity ON users (event_id, first_name, last_name, secret_word);
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users (account_id);

-- 6. Tabella: challenges (minigiochi per evento)
CREATE TABLE IF NOT EXISTS challenges (
    id             SERIAL         PRIMARY KEY,
    event_id       UUID           NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title          TEXT           NOT NULL,
    description    TEXT           NOT NULL,
    points         INTEGER        NOT NULL CHECK (points >= 0),
    type           challenge_type NOT NULL,
    active         BOOLEAN        NOT NULL DEFAULT TRUE,
    correct_answer TEXT,          -- per quiz
    vote_options   JSONB,         -- per vote
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_event_id ON challenges (event_id);

-- 7. Tabella: user_submissions (foto, risposte quiz, voti, caccia al tesoro)
CREATE TABLE IF NOT EXISTS user_submissions (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id INTEGER        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    image_url    TEXT,
    answer_text  TEXT,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id      ON user_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON user_submissions (challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_challenge ON user_submissions (user_id, challenge_id);

-- 8. Tabella: sessions (token di sessione guest e account)
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID        REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- 9. Tabella: registration_reminders (promemoria registrazione post-evento)
CREATE TABLE IF NOT EXISTS registration_reminders (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    send_after  TIMESTAMPTZ NOT NULL,
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_send_after ON registration_reminders (send_after)
    WHERE sent_at IS NULL;

-- 10. Tabella: email_verification_codes (codici OTP 6 cifre)
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT        NOT NULL,
    code        VARCHAR(6)  NOT NULL,
    purpose     TEXT        NOT NULL DEFAULT 'registration',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes 
    ON email_verification_codes (email, code) 
    WHERE used_at IS NULL;

-- 11. Trigger per il calcolo automatico dei punti
CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
DECLARE
    pts INTEGER;
    old_pts INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT points INTO pts FROM challenges WHERE id = NEW.challenge_id;
        UPDATE users SET total_points = total_points + COALESCE(pts, 0) WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT points INTO pts     FROM challenges WHERE id = NEW.challenge_id;
        SELECT points INTO old_pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users
            SET total_points = total_points - COALESCE(old_pts, 0) + COALESCE(pts, 0)
            WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT points INTO pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users SET total_points = total_points - COALESCE(pts, 0) WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_points ON user_submissions;
CREATE TRIGGER trg_update_user_points
    AFTER INSERT OR UPDATE OR DELETE ON user_submissions
    FOR EACH ROW EXECUTE FUNCTION update_user_points();
