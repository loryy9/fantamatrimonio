-- ============================================================
-- Fanta Matrimonio — Migrazione v3
-- Aggiorna i punti per la challenge 'photo' (Gallery della festa)
-- portandoli da 1 a 10 e ricalcola i punti totali degli utenti.
-- Da eseguire nell'SQL Editor di Supabase.
-- ============================================================

-- 1. Aggiorna la challenge photo a 10 punti
UPDATE challenges 
SET points = 10 
WHERE type = 'photo';

-- 2. Ricalcola total_points per tutti gli utenti basandosi sulle loro submission correnti
UPDATE users u
SET total_points = COALESCE((
    SELECT SUM(
        CASE 
            WHEN c.type = 'quiz' AND lower(trim(s.answer_text)) = lower(trim(c.correct_answer)) THEN c.points
            WHEN c.type != 'quiz' THEN c.points
            ELSE 0
        END
    )
    FROM user_submissions s
    JOIN challenges c ON c.id = s.challenge_id
    WHERE s.user_id = u.id
), 0);
