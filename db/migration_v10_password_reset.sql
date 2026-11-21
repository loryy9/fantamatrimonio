-- ============================================================
-- Migrazione v10: recupero password
-- Conta i tentativi errati sui codici OTP: per il recupero password
-- il codice viene invalidato dopo 5 tentativi sbagliati (anti brute force).
-- Esegui nell'SQL Editor di Neon sul database esistente.
-- ============================================================

ALTER TABLE email_verification_codes
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
