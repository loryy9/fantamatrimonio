"""
Modulo per la gestione dei codici di verifica email (OTP 6 cifre).
Supporta generazione sicura, rate limiting, invio via email_service e verifica atomica.
"""
import logging
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

import db
from email_service import send_verification_email

logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_and_send_code(email: str, purpose: str = "registration") -> dict:
    """
    Genera un codice a 6 cifre, lo memorizza nel DB e lo invia via email.
    Include rate limit per evitare invii ripetuti ravvicinati (minimo 20 secondi).
    """
    norm_email = normalize_email(email)
    if not norm_email or "@" not in norm_email:
        raise HTTPException(status_code=422, detail="Indirizzo email non valido.")

    # Rate limiting: controlla se e' stato inviato un codice negli ultimi 20 secondi
    recent = db.query_one(
        """
        SELECT created_at FROM email_verification_codes
        WHERE email = %s AND purpose = %s AND used_at IS NULL AND created_at > (NOW() - INTERVAL '20 seconds')
        ORDER BY created_at DESC LIMIT 1
        """,
        (norm_email, purpose),
    )
    if recent:
        raise HTTPException(
            status_code=429,
            detail="Hai già richiesto un codice di recente. Attendi 20 secondi prima di richiederne un altro.",
        )

    # Invalida codici precedenti inutilizzati per questo scopo
    db.execute(
        """
        UPDATE email_verification_codes
        SET used_at = NOW()
        WHERE email = %s AND purpose = %s AND used_at IS NULL
        """,
        (norm_email, purpose),
    )

    # Genera codice a 6 cifre (es. '481920')
    code = f"{secrets.randbelow(1000000):06d}"

    # Salva nel DB con scadenza 15 minuti
    db.execute(
        """
        INSERT INTO email_verification_codes (email, code, purpose, expires_at)
        VALUES (%s, %s, %s, NOW() + INTERVAL '15 minutes')
        """,
        (norm_email, code, purpose),
    )

    # Invia email reale (o mock se SMTP non configurato)
    sent = send_verification_email(norm_email, code, purpose)
    logger.info(f"[VERIFICATION OTP] Email: {norm_email} | Code: {code} | Sent: {sent}")

    if not sent:
        raise HTTPException(
            status_code=500,
            detail="Impossibile inviare l'email con il codice di verifica. Verifica che l'indirizzo email sia corretto."
        )

    return {
        "success": True,
        "message": f"Codice di verifica inviato a {norm_email}",
        "expires_in_minutes": 15,
    }


def verify_code(email: str, code: str, purpose: str = "registration", mark_used: bool = True) -> bool:
    """
    Verifica che il codice a 6 cifre sia valido, non scaduto e non gia' utilizzato.
    Se mark_used e' True, lo marca come utilizzato per impedirne il riuso.
    """
    norm_email = normalize_email(email)
    clean_code = (code or "").strip()

    if not norm_email or not clean_code or len(clean_code) != 6:
        return False

    row = db.query_one(
        """
        SELECT id FROM email_verification_codes
        WHERE email = %s AND code = %s AND purpose = %s AND used_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
        """,
        (norm_email, clean_code, purpose),
    )

    if not row:
        return False

    if mark_used:
        db.execute(
            "UPDATE email_verification_codes SET used_at = NOW() WHERE id = %s",
            (row["id"],),
        )

    return True
