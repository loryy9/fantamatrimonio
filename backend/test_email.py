"""
Script per testare rapidamente l'invio di un'email (es. con Gmail o altro SMTP).
Utilizzo:
  .venv\\Scripts\\python test_email.py tuamail@esempio.com
"""
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def main():
    if len(sys.argv) < 2:
        print("\nUso: python test_email.py <tua_email@esempio.com>\n")
        sys.exit(1)

    to_email = sys.argv[1].strip()

    from config import SMTP_HOST, SMTP_PORT, SMTP_USER, GMAIL_ADDRESS
    from email_service import send_email, build_reminder_email_html, is_smtp_configured

    print("=" * 60)
    print("TEST INVIO EMAIL - FANTA MATRIMONIO")
    print("=" * 60)
    print(f"Destinatario: {to_email}")
    print(f"SMTP Host:    {SMTP_HOST or '(non configurato)'}")
    print(f"SMTP Port:    {SMTP_PORT}")
    print(f"SMTP User:    {SMTP_USER or '(non configurato)'}")
    print(f"Gmail Addr:   {GMAIL_ADDRESS or '(non usato)'}")
    print(f"Configurato:  {is_smtp_configured()}")
    print("=" * 60)

    if not is_smtp_configured():
        print("\n[ATTENZIONE] Credenziali SMTP non configurate in backend/.env!")
        print("Aggiungi in .env:")
        print("  GMAIL_ADDRESS=latuaemail@gmail.com")
        print("  GMAIL_APP_PASSWORD=tua_password_app\n")
        return

    print("\nInvio in corso...")
    html = build_reminder_email_html(
        guest_name="Invitato di Test",
        spouse1="Giulia",
        spouse2="Marco",
        invite_code="TEST12",
        registration_url="http://localhost:5173/entra?code=TEST12&upgrade=1",
    )
    subject = "💍 [TEST] I ricordi del matrimonio di Giulia & Marco"

    success = send_email(to_email, subject, html, text_content="Email di test inviata con successo da Fanta Matrimonio!")
    if success:
        print("\nSUCCESS! Email inviata correttamente. Controlla la tua casella di posta (incluso Spam).")
    else:
        print("\nERRORE durante l'invio. Verifica username e password dell'app.")

if __name__ == "__main__":
    main()
