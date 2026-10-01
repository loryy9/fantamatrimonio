import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY: str = os.environ["SUPABASE_SERVICE_KEY"]
STORAGE_BUCKET: str = os.environ.get("STORAGE_BUCKET", "wedding-photos")
PORT: int = int(os.environ.get("PORT", 8000))

# ── Auth & JWT ───────────────────────────────────────────────────────────────
JWT_SECRET: str = os.environ.get("JWT_SECRET", "changeme-in-production-please")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_HOURS: int = int(os.environ.get("JWT_EXPIRE_HOURS", 720))  # 30 giorni

# ── Registration Reminder ────────────────────────────────────────────────────
# Se impostato a 0, le email vengono inviate immediatamente (ottimo per i test)
REGISTRATION_REMINDER_DAYS: float = float(os.environ.get("REGISTRATION_REMINDER_DAYS", 7))

# ── Email & SMTP ─────────────────────────────────────────────────────────────
GMAIL_ADDRESS: str | None = os.environ.get("GMAIL_ADDRESS")
_gmail_pass: str | None = os.environ.get("GMAIL_APP_PASSWORD")
GMAIL_APP_PASSWORD: str | None = _gmail_pass.replace(" ", "") if _gmail_pass else None

# Se configurato GMAIL_ADDRESS e GMAIL_APP_PASSWORD, usa automaticamente smtp.gmail.com
SMTP_HOST: str | None = os.environ.get("SMTP_HOST") or ("smtp.gmail.com" if GMAIL_ADDRESS else None)
SMTP_PORT: int = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER: str | None = os.environ.get("SMTP_USER") or GMAIL_ADDRESS
SMTP_PASSWORD: str | None = os.environ.get("SMTP_PASSWORD") or GMAIL_APP_PASSWORD
SMTP_FROM: str = os.environ.get("SMTP_FROM") or (
    f"Fanta Matrimonio <{GMAIL_ADDRESS}>" if GMAIL_ADDRESS else "Fanta Matrimonio <noreply@fantamatrimonio.it>"
)
FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:5173")
