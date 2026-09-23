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
-- TABLE: users
-- Autenticazione custom: nome + cognome + parola personale
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name   TEXT        NOT NULL,
    last_name    TEXT        NOT NULL,
    secret_word  TEXT        NOT NULL,   -- salvata in chiaro (non è una password)
    total_points INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Identità univoca: stesse credenziali = stesso account da qualsiasi device
    CONSTRAINT uq_user_identity UNIQUE (first_name, last_name, secret_word)
);

-- Indice per velocizzare il lookup al login
CREATE INDEX idx_users_identity
    ON users (first_name, last_name, secret_word);

-- ────────────────────────────────────────────────────────────
-- TABLE: challenges
-- I minigiochi sono dati, non codice hardcoded.
-- ────────────────────────────────────────────────────────────

CREATE TABLE challenges (
    id             SERIAL         PRIMARY KEY,
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
        UPDATE users SET total_points = total_points + pts WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Upsert voto: challenge_id non cambia, i punti sono gli stessi.
        -- Non facciamo nulla per evitare doppi conteggi.
        -- Se in futuro i punti della challenge cambiano, questa logica
        -- gestisce correttamente la differenza.
        SELECT points INTO pts     FROM challenges WHERE id = NEW.challenge_id;
        SELECT points INTO old_pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users
            SET total_points = total_points - old_pts + pts
            WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT points INTO pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users SET total_points = total_points - pts WHERE id = OLD.user_id;
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
-- DATI INIZIALI: challenge di esempio
-- ⚠ Personalizza correct_answer e vote_options prima dell'evento!
-- ────────────────────────────────────────────────────────────

INSERT INTO challenges (title, description, points, type, active, correct_answer, vote_options) VALUES

-- Gallery della festa
(
    'Gallery della festa',
    'Scatta una foto della festa e condividila con tutti gli invitati!',
    10,
    'photo',
    TRUE,
    NULL,
    NULL
),

-- Missioni caccia fotografica
(
    'Il brindisi del tavolo',
    'Cattura il momento in cui il tuo tavolo alza i calici insieme. Tutti devono essere nel frame!',
    5,
    'hunt',
    TRUE,
    NULL,
    NULL
),
(
    'La risata più bella',
    'Fotografa una risata genuina e contagiosa. Più è spontanea, meglio è!',
    5,
    'hunt',
    TRUE,
    NULL,
    NULL
),
(
    'Il ballo più scatenato',
    'Immortala chi si sta divertendo di più sulla pista da ballo.',
    5,
    'hunt',
    TRUE,
    NULL,
    NULL
),
(
    'Gli sposi che si baciano',
    'Cogli il momento: un bacio degli sposi, spontaneo o provocato dagli invitati.',
    5,
    'hunt',
    TRUE,
    NULL,
    NULL
),
(
    'Il dettaglio decorativo più bello',
    'Trova e fotografa il dettaglio decorativo del matrimonio che ti ha colpito di più.',
    5,
    'hunt',
    TRUE,
    NULL,
    NULL
),

-- Vota il momento più bello
(
    'Vota il momento più bello',
    'Qual è stato il momento più emozionante finora? Vota il tuo preferito!',
    3,
    'vote',
    TRUE,
    NULL,
    '["Il primo bacio da sposi", "Il taglio della torta", "Il primo ballo", "L''ingresso in sala"]'::jsonb
),

-- Quiz sugli sposi (⚠ personalizza le risposte corrette!)
(
    'Dove si sono conosciuti gli sposi?',
    'Sai dove si sono incontrati per la prima volta?',
    4,
    'quiz',
    TRUE,
    'università',
    NULL
),
(
    'Quanti anni stavano insieme prima del matrimonio?',
    'Da quanto tempo stavano insieme prima di sposarsi?',
    4,
    'quiz',
    TRUE,
    '3',
    NULL
),
(
    'Qual è la canzone del primo ballo?',
    'Indovina la canzone scelta dagli sposi per il primo ballo.',
    4,
    'quiz',
    TRUE,
    'perfect',
    NULL
);

-- ────────────────────────────────────────────────────────────
-- RIEPILOGO TABELLE:
--   users            → identità invitati + punti totali
--   challenges       → minigiochi configurabili (active = toggle)
--   user_submissions → ogni azione utente, punti assegnati subito
--   sessions         → token 30gg per ripristino sessione
-- ────────────────────────────────────────────────────────────
