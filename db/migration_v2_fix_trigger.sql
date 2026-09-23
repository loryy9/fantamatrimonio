-- ============================================================
-- Fanta Matrimonio — Migrazione v2
-- Corregge il trigger update_user_points per gestire il quiz:
-- i punti vengono assegnati SOLO se la risposta è corretta.
-- Da eseguire nell'SQL Editor di Supabase dopo schema.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
DECLARE
    pts       INTEGER;
    old_pts   INTEGER;
    c_type    challenge_type;
    c_correct TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT points, type, correct_answer
            INTO pts, c_type, c_correct
            FROM challenges WHERE id = NEW.challenge_id;

        IF c_type = 'quiz' THEN
            -- Punti solo se la risposta è corretta (confronto case-insensitive)
            IF lower(trim(NEW.answer_text)) = lower(trim(c_correct)) THEN
                UPDATE users SET total_points = total_points + pts WHERE id = NEW.user_id;
            END IF;
        ELSE
            -- photo, hunt, vote: punti assegnati immediatamente
            UPDATE users SET total_points = total_points + pts WHERE id = NEW.user_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Usato dall'upsert dei voti: challenge_id non cambia,
        -- quindi old_pts = pts → delta netto = 0.
        -- Gestiamo comunque per robustezza futura.
        SELECT points INTO old_pts FROM challenges WHERE id = OLD.challenge_id;
        SELECT points INTO pts     FROM challenges WHERE id = NEW.challenge_id;
        UPDATE users
            SET total_points = total_points - old_pts + pts
            WHERE id = NEW.user_id;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT points INTO pts FROM challenges WHERE id = OLD.challenge_id;
        UPDATE users SET total_points = total_points - pts WHERE id = OLD.user_id;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Il trigger è già attivo, CREATE OR REPLACE aggiorna solo la funzione.
