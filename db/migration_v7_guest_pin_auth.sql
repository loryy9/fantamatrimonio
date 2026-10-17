-- ============================================================
-- Migrazione v7: Login invitati con Nickname + PIN 4 cifre
-- + Refresh Token sulle sessioni
-- Eseguire nell'SQL Editor di Neon sul database esistente.
-- ============================================================

-- 1. Rinomina first_name → nickname sulla tabella users
ALTER TABLE users RENAME COLUMN first_name TO nickname;

-- 2. Elimina le colonne non più necessarie
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- 3. Trasforma secret_word → pin
--    Il PIN è usato SOLO per gli invitati (4 cifre). Per gli sposi è NULL.
ALTER TABLE users RENAME COLUMN secret_word TO pin;
ALTER TABLE users ALTER COLUMN pin TYPE TEXT;
ALTER TABLE users ALTER COLUMN pin DROP NOT NULL;
ALTER TABLE users ALTER COLUMN pin SET DEFAULT NULL;
UPDATE users SET pin = NULL WHERE role = 'couple';

-- 4. Aggiorna il vincolo di unicità: nickname univoco per evento
ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_user_identity_per_event;
-- Creiamo un indice univoco funzionale su LOWER(nickname) per evento
CREATE UNIQUE INDEX IF NOT EXISTS uq_nickname_per_event ON users (event_id, LOWER(nickname));

-- 5. Aggiorna gli indici
DROP INDEX IF EXISTS idx_users_identity;
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (event_id, LOWER(nickname));

-- 6. Aggiungi refresh_token e refresh_expires_at alla tabella sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days');

-- 7. Accorcia il TTL default dell'access token (nuove sessioni: 2 ore)
--    Le sessioni esistenti mantengono il loro expires_at originale
ALTER TABLE sessions ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '2 hours');

-- 8. Indice sul refresh_token per lookup veloci
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token);
