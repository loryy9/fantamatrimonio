"""
Servizio per l'invio delle email di notifica e reminder registrazione.
Supporta qualsiasi provider SMTP standard (SendGrid, Resend, Brevo, Gmail, custom SMTP).
Se SMTP non e' configurato, le email vengono loggate in console (modalita' sviluppo).
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

import db
from config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
    FRONTEND_URL,
)

logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    """Verifica se i parametri minimi per l'invio email sono configurati."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_email(to_email: str, subject: str, html_content: str, text_content: str | None = None) -> bool:
    """
    Invia un'email HTML a to_email.
    Se SMTP non e' configurato, logga il messaggio per debug e ritorna True.
    """
    if not is_smtp_configured():
        logger.info(
            f"[MOCK EMAIL] To: {to_email} | Subject: {subject}\n"
            f"SMTP non configurato. Per inviare email reali, imposta SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env."
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())

        logger.info(f"Email inviata con successo a {to_email}")
        return True
    except Exception as e:
        logger.error(f"Errore durante l'invio dell'email a {to_email}: {e}")
        return False


def build_reminder_email_html(
    guest_name: str,
    spouse1: str,
    spouse2: str,
    invite_code: str,
    registration_url: str,
) -> str:
    """Template email curato con design coordinato all'app (colori oro/bordeaux)."""
    couples_label = f"{spouse1} & {spouse2}" if spouse2 else spouse1

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>I ricordi del matrimonio di {couples_label}</title>
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
                Ciao <strong>{guest_name}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #d6cfc7; margin: 0 0 20px;">
                Che festa indimenticabile! Il matrimonio di <strong style="color: #f0d8a8;">{couples_label}</strong> è stato ricco di momenti speciali, risate e foto meravigliose.
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #d6cfc7; margin: 0 0 28px;">
                Se vuoi conservare per sempre lo storico dei tuoi quiz, il punteggio finale e tutte le foto scattate durante i giochi, puoi <strong>registrare il tuo account gratuito</strong> in un click.
              </p>

              <!-- Call to Action -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%); box-shadow: 0 6px 20px rgba(212, 175, 55, 0.35);">
                    <a href="{registration_url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #160e12; text-decoration: none; border-radius: 999px; letter-spacing: 0.5px;">
                      Salva i tuoi ricordi &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Event Details Box -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(240, 216, 168, 0.2); border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 20px;">
                <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a89f91;">Codice invito matrimonio:</span>
                <div style="font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 3px; color: #f0d8a8; margin-top: 4px;">
                  {invite_code}
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
"""


def process_due_reminders(limit: int = 50) -> dict:
    """
    Trova i reminder scaduti (send_after <= NOW() e sent_at IS NULL),
    invia le email e aggiorna sent_at.
    Ritorna un sommario con il numero di email inviate e fallite.
    """
    now = datetime.now(timezone.utc)
    reminders = db.query(
        """
        SELECT r.id, r.email, r.user_id, r.event_id,
               u.first_name, u.last_name,
               e.spouse1_name, e.spouse2_name, e.invite_code
        FROM registration_reminders r
        JOIN users u ON u.id = r.user_id
        JOIN events e ON e.id = r.event_id
        WHERE r.sent_at IS NULL AND r.send_after <= %s
        ORDER BY r.send_after ASC
        LIMIT %s
        """,
        (now, limit),
    )

    sent_count = 0
    failed_count = 0

    for rem in reminders:
        guest_name = f"{rem['first_name']} {rem['last_name']}".strip()
        spouse1 = rem["spouse1_name"]
        spouse2 = rem.get("spouse2_name") or ""
        code = rem["invite_code"]
        reg_url = f"{FRONTEND_URL}/entra?code={code}&upgrade=1"

        subject = f"💍 I ricordi del matrimonio di {spouse1} & {spouse2} ti aspettano!"
        html = build_reminder_email_html(
            guest_name=guest_name,
            spouse1=spouse1,
            spouse2=spouse2,
            invite_code=code,
            registration_url=reg_url,
        )
        text = (
            f"Ciao {guest_name}!\n\n"
            f"I ricordi del matrimonio di {spouse1} & {spouse2} sono pronti.\n"
            f"Per salvare il tuo storico e vedere tutte le foto, registrati qui: {reg_url}\n\n"
            f"Codice evento: {code}"
        )

        ok = send_email(rem["email"], subject, html, text)
        if ok:
            db.execute(
                "UPDATE registration_reminders SET sent_at = NOW() WHERE id = %s",
                (rem["id"],),
            )
            sent_count += 1
        else:
            failed_count += 1

    return {
        "processed": len(reminders),
        "sent": sent_count,
        "failed": failed_count,
    }
