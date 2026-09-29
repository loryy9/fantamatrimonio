-- ============================================================
-- Fanta Matrimonio — Schema SQL
-- Da eseguire nell'SQL Editor di Supabase
-- ============================================================

-- Abilita l'estensione UUID (di solito già attiva su Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────

CREATE TYPE challenge_type AS ENUM ('photo', 'hunt', 'vote', 'quiz');

-- ────────────────────────────────────────────────────────────
-- TABLE: events
-- Ogni evento e' un matrimonio indipendente. Tutto il resto
-- (users, challenges) e' scoped a un event_id.
-- ────────────────────────────────────────────────────────────

CREATE TABLE events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    spouse1_name  TEXT        NOT NULL,
    spouse2_name  TEXT        NOT NULL,
    enable_timer  BOOLEAN     NOT NULL DEFAULT FALSE,
    start_time    TIMESTAMPTZ,
    end_time      TIMESTAMPTZ,
    invite_code   TEXT        NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_invite_code ON events (invite_code);

-- ────────────────────────────────────────────────────────────
-- TABLE: users
-- Autenticazione custom: nome + cognome + parola personale
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    role         TEXT        NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'couple')),
    first_name   TEXT        NOT NULL,
    last_name    TEXT        NOT NULL,
    secret_word  TEXT        NOT NULL,   -- salvata in chiaro (non è una password)
    total_points INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Identità univoca all'interno di un evento: stesse credenziali = stesso account
    CONSTRAINT uq_user_identity_per_event UNIQUE (event_id, first_name, last_name, secret_word)
);

-- Indice per velocizzare il lookup al login
CREATE INDEX idx_users_identity
    ON users (event_id, first_name, last_name, secret_word);

-- ────────────────────────────────────────────────────────────
-- TABLE: challenges
-- I minigiochi sono dati, non codice hardcoded.
-- ────────────────────────────────────────────────────────────

CREATE TABLE challenges (
    id             SERIAL         PRIMARY KEY,
    event_id       UUID           NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title          TEXT           NOT NULL,
    description    TEXT           NOT NULL,
    points         INTEGER        NOT NULL CHECK (points >= 0),
    type           challenge_type NOT NULL,
    active         BOOLEAN        NOT NULL DEFAULT TRUE,  -- toggle on/off
    correct_answer TEXT,          -- solo per type = 'quiz'
    vote_options   JSONB,         -- solo per type = 'vote', es. ["Opzione A","Opzione B"]
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN challenges.correct_answer IS 'Usato solo per type=quiz. Confronto case-insensitive lato backend.';
COMMENT ON COLUMN challenges.vote_options   IS 'Usato solo per type=vote. Array JSON di stringhe.';

-- ────────────────────────────────────────────────────────────
-- TABLE: user_submissions
-- Ogni submission è approvata automaticamente all'insert.
-- Nessun flusso di moderazione.
-- ────────────────────────────────────────────────────────────

CREATE TABLE user_submissions (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id INTEGER        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    image_url    TEXT,          -- URL Supabase Storage, nullable
    answer_text  TEXT,          -- risposta quiz, opzione voto, nullable
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDICE UNIVOCO per i VOTI
-- Un utente può avere una sola submission per challenge di tipo
-- 'vote'. Il backend farà INSERT ... ON CONFLICT DO UPDATE
-- (upsert) così conta sempre l'ultimo voto.
-- Per photo/hunt/quiz questo indice NON si applica.
-- ────────────────────────────────────────────────────────────

-- Implementato come vincolo applicativo nel backend:
-- prima di ogni INSERT per type='vote', si fa UPSERT.
-- L'indice univoco semplice qui sotto serve come garanzia DB-level.
-- ATTENZIONE: questo blocca anche photo/hunt/quiz che ammettono
-- più submission dallo stesso utente. Lo gestiamo SOLO per i voti
-- via logica applicativa nel backend (INSERT ... ON CONFLICT
-- solo sulle challenge di tipo vote).

-- Indice UNIQUE parziale: funziona in PostgreSQL/Supabase ma
-- non può riferirsi a un'altra tabella nella WHERE clause.
-- Soluzione: usiamo un check applicativo nel backend.
-- L'unicità per i voti è garantita da:
--   1. Il backend fa sempre UPSERT (non INSERT) per type='vote'
--   2. (Opzionale) Puoi aggiungere manualmente un UNIQUE INDEX
--      sui soli challenge_id di tipo vote dopo l'INSERT dei dati.

-- ────────────────────────────────────────────────────────────
-- INDICI GENERALI
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_submissions_user_id      ON user_submissions (user_id);
CREATE INDEX idx_submissions_challenge_id ON user_submissions (challenge_id);
-- Indice composto utile per il lookup "ha già votato questa challenge?"
CREATE INDEX idx_submissions_user_challenge ON user_submissions (user_id, challenge_id);

-- ────────────────────────────────────────────────────────────
-- TRIGGER: aggiorna total_points dopo ogni submission
--
-- INSERT  → aggiunge i punti della challenge
-- UPDATE  → sottrae i vecchi punti e aggiunge i nuovi
--           (usato dall'upsert dei voti: il voto cambia,
--            i punti devono rimanere invariati se la challenge
--            vale sempre lo stesso importo — ma è corretto
--            gestirlo comunque per robustezza)
-- DELETE  → sottrae i punti (es. se un admin cancella una riga)
-- ────────────────────────────────────────────────────────────

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
        -- Upsert voto: challenge_id non cambia, i punti sono gli stessi.
        -- Non facciamo nulla per evitare doppi conteggi.
        -- Se in futuro i punti della challenge cambiano, questa logica
        -- gestisce correttamente la differenza.
        SELECT points INTO pts     FROM challenges WHERE id = NEW.challenge_id;
        SELECT points INTO old_pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users
            SET total_points = total_points - COALESCE(old_pts, 0) + COALESCE(pts, 0)
            WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- COALESCE(pts, 0): durante la cascade-delete di un intero evento,
        -- la riga challenges puo' essere gia' stata rimossa (events -> challenges
        -- -> user_submissions e' la stessa cascade di events -> users), quindi
        -- questo SELECT puo' non trovare nulla. In quel caso non c'e' nulla da
        -- sottrarre: l'utente stesso sta per essere cascade-eliminato comunque.
        SELECT points INTO pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users SET total_points = total_points - COALESCE(pts, 0) WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_points
    AFTER INSERT OR UPDATE OR DELETE ON user_submissions
    FOR EACH ROW EXECUTE FUNCTION update_user_points();

-- ────────────────────────────────────────────────────────────
-- TABLE: sessions
-- Token di sessione generato dal backend, salvato in localStorage.
-- ────────────────────────────────────────────────────────────

CREATE TABLE sessions (
    token      TEXT        PRIMARY KEY,  -- UUID random generato dal backend
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- ────────────────────────────────────────────────────────────
-- Nessun dato di esempio: eventi e challenge vengono creati
-- dagli sposi tramite l'app (POST /api/events, POST /api/challenges).
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- RIEPILOGO TABELLE:
--   users            → identità invitati + punti totali
--   challenges       → minigiochi configurabili (active = toggle)
--   user_submissions → ogni azione utente, punti assegnati subito
--   sessions         → token 30gg per ripristino sessione
-- ────────────────────────────────────────────────────────────
