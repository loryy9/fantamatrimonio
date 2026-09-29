-- ============================================================
-- Migrazione v4: multi-tenancy (eventi/matrimoni multipli)
-- Esegui nell'SQL Editor di Supabase sul database esistente.
-- ⚠ PERSONALIZZA i valori dell'evento legacy prima di eseguire!
-- ============================================================

-- 1. Tabella eventi
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

-- 2. Evento di default per i dati esistenti.
--    ⚠ Sostituisci 'Sposo1'/'Sposo2' con i nomi reali prima di eseguire!
INSERT INTO events (spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code)
VALUES ('Sposo1', 'Sposo2', FALSE, NULL, NULL, 'LEGACY1');

-- 3. Aggiungi le colonne come NULLABLE per poter fare il backfill
ALTER TABLE users ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'couple'));
ALTER TABLE challenges ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- 4. Backfill: tutti i dati esistenti appartengono all'evento di default
UPDATE users SET event_id = (SELECT id FROM events WHERE invite_code = 'LEGACY1') WHERE event_id IS NULL;
UPDATE challenges SET event_id = (SELECT id FROM events WHERE invite_code = 'LEGACY1') WHERE event_id IS NULL;

-- 5. Ora che tutte le righe hanno un event_id, rendi la colonna obbligatoria
ALTER TABLE users ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE challenges ALTER COLUMN event_id SET NOT NULL;

-- 6. Sostituisci il vincolo di unicita' globale con uno per-evento
ALTER TABLE users DROP CONSTRAINT uq_user_identity;
ALTER TABLE users ADD CONSTRAINT uq_user_identity_per_event
    UNIQUE (event_id, first_name, last_name, secret_word);

DROP INDEX IF EXISTS idx_users_identity;
CREATE INDEX idx_users_identity ON users (event_id, first_name, last_name, secret_word);

-- 7. Il trigger update_user_points() assume che la riga challenges esista
--    ancora quando una user_submissions viene eliminata. Non era un problema
--    finche' si eliminavano solo singole righe, ma ora che un intero evento
--    puo' essere cascade-eliminato (events -> challenges -> user_submissions
--    e events -> users sono la stessa cascade), la riga challenges puo'
--    essere gia' sparita quando il trigger legge i suoi punti, con un NULL
--    che violerebbe il NOT NULL su users.total_points. Fix: COALESCE a 0.
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

-- 8. Mostra l'id dell'evento legacy (il codice invito e' 'LEGACY1',
--    aggiornalo con un UPDATE events SET invite_code = '...' se vuoi
--    un codice piu' leggibile da comunicare agli invitati esistenti)
DO $$
DECLARE
    legacy_id UUID;
BEGIN
    SELECT id INTO legacy_id FROM events WHERE invite_code = 'LEGACY1';
    RAISE NOTICE 'Evento legacy creato con id % e codice invito LEGACY1.', legacy_id;
END $$;
