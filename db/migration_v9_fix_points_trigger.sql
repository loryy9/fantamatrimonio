-- ============================================================
-- Fanta Matrimonio — Migrazione v9
-- Ripristina la regola "quiz: punti SOLO se la risposta è corretta".
-- La v4 aveva sovrascritto il trigger della v2 riassegnando i punti
-- anche alle risposte sbagliate. Qui il trigger torna corretto
-- (mantenendo il COALESCE della v4) e si ricalcolano i punteggi.
-- Idempotente: si può rieseguire senza effetti collaterali.
-- ============================================================

-- Punti realmente guadagnati da una submission (0 se quiz sbagliato).
CREATE OR REPLACE FUNCTION submission_points(p_challenge_id INTEGER, p_answer TEXT)
RETURNS INTEGER AS $$
    SELECT COALESCE(
        CASE
            WHEN c.type = 'quiz' THEN
                CASE WHEN lower(trim(COALESCE(p_answer, ''))) = lower(trim(COALESCE(c.correct_answer, '')))
                     THEN c.points ELSE 0 END
            ELSE c.points
        END, 0)
    FROM challenges c WHERE c.id = p_challenge_id
    UNION ALL SELECT 0
    LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET total_points = total_points + submission_points(NEW.challenge_id, NEW.answer_text)
            WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE users SET total_points = total_points
            - submission_points(OLD.challenge_id, OLD.answer_text)
            + submission_points(NEW.challenge_id, NEW.answer_text)
            WHERE id = NEW.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users SET total_points = total_points - submission_points(OLD.challenge_id, OLD.answer_text)
            WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_points ON user_submissions;
CREATE TRIGGER trg_update_user_points
    AFTER INSERT OR UPDATE OR DELETE ON user_submissions
    FOR EACH ROW EXECUTE FUNCTION update_user_points();

-- Ricalcolo di tutti i punteggi dalle submission esistenti.
UPDATE users u
SET total_points = COALESCE((
    SELECT SUM(submission_points(s.challenge_id, s.answer_text))
    FROM user_submissions s
    WHERE s.user_id = u.id
), 0);
