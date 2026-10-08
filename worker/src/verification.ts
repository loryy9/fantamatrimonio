/**
 * Codici di verifica email (OTP a 6 cifre): generazione sicura, rate limiting,
 * invio via email e verifica atomica.
 */
import type { Config } from "./config";
import type { Db } from "./db";
import { sendVerificationEmail } from "./email";
import { ApiError } from "./errors";
import { randomInt } from "./util";

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Genera un codice a 6 cifre, lo salva nel DB e lo invia via email.
 * Rate limit: un solo invio ogni 20 secondi per (email, scopo).
 */
export async function createAndSendCode(
  db: Db,
  cfg: Config,
  email: string,
  purpose = "registration",
): Promise<Record<string, unknown>> {
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes("@")) throw new ApiError(422, "Indirizzo email non valido.");

  const recent = await db.queryOne(
    `SELECT created_at FROM email_verification_codes
     WHERE email = $1 AND purpose = $2 AND used_at IS NULL AND created_at > (NOW() - INTERVAL '20 seconds')
     ORDER BY created_at DESC LIMIT 1`,
    [norm, purpose],
  );
  if (recent) {
    throw new ApiError(429, "Hai già richiesto un codice di recente. Attendi 20 secondi prima di richiederne un altro.");
  }

  // Invalida i codici precedenti inutilizzati per questo scopo
  await db.execute(
    `UPDATE email_verification_codes SET used_at = NOW() WHERE email = $1 AND purpose = $2 AND used_at IS NULL`,
    [norm, purpose],
  );

  const code = String(randomInt(1_000_000)).padStart(6, "0");

  await db.execute(
    `INSERT INTO email_verification_codes (email, code, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [norm, code, purpose],
  );

  const sent = await sendVerificationEmail(cfg, norm, code, purpose);
  console.log(`[VERIFICATION OTP] Email: ${norm} | Sent: ${sent}`);

  if (!sent) {
    throw new ApiError(
      500,
      "Impossibile inviare l'email con il codice di verifica. Verifica che l'indirizzo email sia corretto.",
    );
  }

  return { success: true, message: `Codice di verifica inviato a ${norm}`, expires_in_minutes: 15 };
}

/** Verifica che il codice sia valido, non scaduto e non gia' usato. Se `markUsed`, lo consuma. */
export async function verifyCode(
  db: Db,
  email: string,
  code: string,
  purpose = "registration",
  markUsed = true,
): Promise<boolean> {
  const norm = normalizeEmail(email);
  const clean = (code ?? "").trim();
  if (!norm || !clean || clean.length !== 6) return false;

  const row = await db.queryOne(
    `SELECT id FROM email_verification_codes
     WHERE email = $1 AND code = $2 AND purpose = $3 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [norm, clean, purpose],
  );
  if (!row) return false;

  if (markUsed) {
    await db.execute("UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1", [row.id]);
  }
  return true;
}
