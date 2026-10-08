/**
 * Invio email di notifica, codici di verifica e reminder di registrazione.
 * SMTP standard (Gmail, SendGrid, Brevo, ...) via worker-mailer (socket TCP + STARTTLS).
 * Se SMTP non e' configurato le email vengono solo loggate (modalita' sviluppo).
 */
import { WorkerMailer } from "worker-mailer";
import type { Config } from "./config";
import type { Db } from "./db";
import { createClaimToken } from "./auth";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const isSmtpConfigured = (cfg: Config): boolean => !!(cfg.smtpHost && cfg.smtpUser && cfg.smtpPassword);

/** "Nome <a@b.it>" -> {name, email}; "a@b.it" -> stringa. */
function parseAddress(addr: string): string | { name: string; email: string } {
  const m = addr.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, ""), email: m[2] } : addr.trim();
}

/** Invia un'email HTML. Ritorna true se inviata (o loggata in modalita' mock), false se l'invio fallisce. */
export async function sendEmail(
  cfg: Config,
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<boolean> {
  if (!isSmtpConfigured(cfg)) {
    console.log(
      `[MOCK EMAIL] To: ${to} | Subject: ${subject}\n` +
        "SMTP non configurato. Per inviare email reali imposta SMTP_HOST, SMTP_USER, SMTP_PASSWORD (o GMAIL_*).",
    );
    return true;
  }

  try {
    await WorkerMailer.send(
      {
        host: cfg.smtpHost!,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465,
        startTls: cfg.smtpPort !== 465,
        credentials: { username: cfg.smtpUser!, password: cfg.smtpPassword! },
        authType: "plain",
        socketTimeoutMs: 15000,
        responseTimeoutMs: 15000,
      },
      { from: parseAddress(cfg.smtpFrom), to, subject, html, ...(text ? { text } : {}) },
    );
    console.log(`Email inviata con successo a ${to}`);
    return true;
  } catch (e) {
    console.error(`Errore durante l'invio dell'email a ${to}: ${e}`);
    return false;
  }
}

export function buildReminderEmailHtml(p: {
  guestName: string;
  spouse1: string;
  spouse2: string;
  inviteCode: string;
  registrationUrl: string;
}): string {
  const couplesLabel = esc(p.spouse2 ? `${p.spouse1} & ${p.spouse2}` : p.spouse1);
  const guestName = esc(p.guestName);
  const inviteCode = esc(p.inviteCode);
  const registrationUrl = esc(p.registrationUrl);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>I ricordi del matrimonio di ${couplesLabel}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f0eb;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0a0b; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: linear-gradient(180deg, #1f1418 0%, #160e12 100%); border: 1px solid rgba(240, 216, 168, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 32px 20px; text-align: center; border-bottom: 1px solid rgba(240, 216, 168, 0.12);">
              <div style="font-size: 32px; margin-bottom: 8px;">💍✨</div>
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 26px; font-weight: 400; color: #f0d8a8; letter-spacing: 0.5px;">
                Fanta Matrimonio
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #c4a97d;">
                I ricordi della festa
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="font-size: 17px; line-height: 1.5; color: #ffffff; margin: 0 0 16px;">
                Ciao <strong>${guestName}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #d6cfc7; margin: 0 0 20px;">
                Che festa indimenticabile! Il matrimonio di <strong style="color: #f0d8a8;">${couplesLabel}</strong> è stato ricco di momenti speciali, risate e foto meravigliose.
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #d6cfc7; margin: 0 0 28px;">
                Se vuoi conservare per sempre lo storico dei tuoi quiz, il punteggio finale e tutte le foto scattate durante i giochi, puoi <strong>registrare il tuo account gratuito</strong> in un click.
              </p>

              <!-- Call to Action -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%); box-shadow: 0 6px 20px rgba(212, 175, 55, 0.35);">
                    <a href="${registrationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #160e12; text-decoration: none; border-radius: 999px; letter-spacing: 0.5px;">
                      Salva i tuoi ricordi &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Event Details Box -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(240, 216, 168, 0.2); border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 20px;">
                <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a89f91;">Codice invito matrimonio:</span>
                <div style="font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 3px; color: #f0d8a8; margin-top: 4px;">
                  ${inviteCode}
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #8f8579; margin: 0; text-align: center;">
                Avrai accesso a una comoda dashboard con tutti i matrimoni a cui hai partecipato.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(240, 216, 168, 0.08); text-align: center;">
              <p style="font-size: 12px; color: #736b62; margin: 0;">
                Hai ricevuto questa email perché hai partecipato a Fanta Matrimonio e hai inserito questo indirizzo durante la festa.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function buildVerificationCodeEmailHtml(code: string, purposeLabel = "registrazione"): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codice di Verifica - Fanta Matrimonio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f0eb;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0a0b; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background: linear-gradient(180deg, #1f1418 0%, #160e12 100%); border: 1px solid rgba(240, 216, 168, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 32px 20px; text-align: center; border-bottom: 1px solid rgba(240, 216, 168, 0.12);">
              <div style="font-size: 34px; margin-bottom: 8px;">💍✨</div>
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 26px; font-weight: 400; color: #f0d8a8; letter-spacing: 0.5px;">
                Fanta Matrimonio
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #c4a97d;">
                Verifica della tua email
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 28px; text-align: center;">
              <p style="font-size: 16px; line-height: 1.5; color: #ffffff; margin: 0 0 16px;">
                Per completare la tua <strong>${esc(purposeLabel)}</strong> su Fanta Matrimonio, inserisci questo codice di sicurezza:
              </p>

              <!-- OTP Box -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 24px auto;">
                <tr>
                  <td style="background: rgba(240, 216, 168, 0.12); border: 2px dashed rgba(240, 216, 168, 0.55); border-radius: 14px; padding: 18px 36px; text-align: center;">
                    <span style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 34px; font-weight: 700; letter-spacing: 10px; color: #f0d8a8; display: block; margin-right: -10px;">
                      ${esc(code)}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #a89f91; margin: 20px 0 0; line-height: 1.5;">
                ⏱️ Questo codice è valido per <strong>15 minuti</strong>.<br>
                Se non hai richiesto tu questo codice, puoi ignorare tranquillamente questa email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: rgba(0,0,0,0.3); border-top: 1px solid rgba(240, 216, 168, 0.08); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #7a6e60; line-height: 1.4;">
                Fanta Matrimonio · Gioca, scatta, rispondi e scala la classifica<br>
                Email generata automaticamente, si prega di non rispondere.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const PURPOSE_LABELS: Record<string, string> = {
  register_couple: "creazione del matrimonio",
  register_account: "registrazione account",
  upgrade_account: "registrazione del tuo profilo",
  join_guest: "partecipazione al matrimonio",
};

/** Invia il codice di verifica a 6 cifre. */
export function sendVerificationEmail(cfg: Config, to: string, code: string, purpose = "registration"): Promise<boolean> {
  const label = PURPOSE_LABELS[purpose] ?? "partecipazione";
  return sendEmail(
    cfg,
    to,
    `💍 Il tuo codice di verifica Fanta Matrimonio: ${code}`,
    buildVerificationCodeEmailHtml(code, label),
    `Il tuo codice di verifica Fanta Matrimonio è: ${code}\n\n` +
      `Inseriscilo sul sito per confermare la tua ${label}.\n` +
      `Il codice è valido per 15 minuti.`,
  );
}

/**
 * Invia i reminder scaduti (send_after <= NOW() e sent_at IS NULL) e aggiorna sent_at.
 * Ritorna il numero di email processate / inviate / fallite.
 */
export async function processDueReminders(
  db: Db,
  cfg: Config,
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const reminders = await db.query(
    `SELECT r.id, r.email, r.user_id, r.event_id,
            u.first_name, u.last_name,
            e.spouse1_name, e.spouse2_name, e.invite_code
     FROM registration_reminders r
     JOIN users u ON u.id = r.user_id
     JOIN events e ON e.id = r.event_id
     WHERE r.sent_at IS NULL AND r.send_after <= $1
     ORDER BY r.send_after ASC
     LIMIT $2`,
    [new Date(), limit],
  );

  let sent = 0;
  let failed = 0;

  for (const rem of reminders) {
    const guestName = `${rem.first_name} ${rem.last_name}`.trim();
    const spouse1: string = rem.spouse1_name;
    const spouse2: string = rem.spouse2_name || "";
    const code: string = rem.invite_code;

    const claimToken = await createClaimToken(cfg, String(rem.user_id), String(rem.event_id), rem.email);
    const regUrl = `${cfg.frontendUrl}/completa-account?claim=${claimToken}&code=${code}`;

    const subject = `💍 I ricordi del matrimonio di ${spouse1} & ${spouse2} ti aspettano!`;
    const html = buildReminderEmailHtml({ guestName, spouse1, spouse2, inviteCode: code, registrationUrl: regUrl });
    const text =
      `Ciao ${guestName}!\n\n` +
      `I ricordi del matrimonio di ${spouse1} & ${spouse2} sono pronti.\n` +
      `Per salvare il tuo storico e vedere tutte le foto, registrati qui: ${regUrl}\n\n` +
      `Codice evento: ${code}`;

    if (await sendEmail(cfg, rem.email, subject, html, text)) {
      await db.execute("UPDATE registration_reminders SET sent_at = NOW() WHERE id = $1", [rem.id]);
      sent++;
    } else {
      failed++;
    }
  }

  return { processed: reminders.length, sent, failed };
}
