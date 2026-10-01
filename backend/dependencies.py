"""
Dipendenza FastAPI per autenticare le richieste.
Supporta due modalità:
  1. Session token (UUID): Bearer <token> — lookup nella tabella sessions
  2. JWT: Bearer <jwt> — decodifica e verifica il token firmato

Ritorna l'utente corrente (con event_id e role) o solleva 401/403.
"""
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Header, HTTPException, Depends, Query

import db
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS

# ── Password hashing ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pwd_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT helpers ──────────────────────────────────────────────────────────────

def create_jwt(account_id: str, extra: dict | None = None) -> str:
    """Crea un JWT firmato per un account registrato."""
    payload = {
        "sub": account_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "type": "account",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict | None:
    """Decodifica un JWT. Ritorna il payload o None se non valido."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def create_claim_token(user_id: str, event_id: str, email: str, days: int = 30) -> str:
    """Crea un token firmato per il link di recupero e completamento account inviato via email."""
    payload = {
        "sub": str(user_id),
        "event_id": str(event_id),
        "email": email.strip().lower(),
        "type": "claim_guest",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Auth dependencies ────────────────────────────────────────────────────────

def _is_jwt(token: str) -> bool:
    """Euristica: i JWT hanno 3 segmenti separati da punti."""
    return token.count(".") == 2


def get_current_user(
    authorization: str = Header(default=None),
    event_id: str = Query(default=None, alias="event_id"),
) -> dict:
    """
    Autentica la richiesta.
    - Se il token è un JWT → cerca l'account e il user per event_id (se fornito)
    - Se il token è un session token (UUID) → lookup come prima
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante o non valido.")

    token = authorization.removeprefix("Bearer ").strip()

    if _is_jwt(token):
        payload = decode_jwt(token)
        if not payload or payload.get("type") != "account":
            raise HTTPException(status_code=401, detail="Token JWT non valido o scaduto.")

        account_id = payload["sub"]

        if event_id:
            # Cerca il user specifico per questo evento
            row = db.query_one(
                """
                SELECT u.id, u.event_id, u.role, u.first_name, u.last_name,
                       u.total_points, u.account_id
                FROM users u
                WHERE u.account_id = %s AND u.event_id = %s
                """,
                (account_id, event_id),
            )
        else:
            # Cerca qualsiasi user collegato a questo account (il più recente)
            row = db.query_one(
                """
                SELECT u.id, u.event_id, u.role, u.first_name, u.last_name,
                       u.total_points, u.account_id
                FROM users u
                WHERE u.account_id = %s
                ORDER BY u.created_at DESC
                LIMIT 1
                """,
                (account_id,),
            )

        if not row:
            raise HTTPException(
                status_code=401,
                detail="Nessun profilo evento trovato per questo account."
            )

        # Aggiungiamo l'account_id alla risposta per il frontend
        row["account_id"] = account_id
        return row

    else:
        # Session token classico (UUID)
        row = db.query_one(
            """
            SELECT u.id, u.event_id, u.role, u.first_name, u.last_name,
                   u.total_points, u.account_id
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()
            """,
            (token,),
        )

        if not row:
            raise HTTPException(status_code=401, detail="Sessione scaduta o non trovata.")

        return row


def get_current_couple(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "couple":
        raise HTTPException(status_code=403, detail="Solo gli sposi possono eseguire questa azione.")
    return current_user


def get_current_account(authorization: str = Header(default=None)) -> dict:
    """
    Dipendenza che richiede un JWT valido e ritorna l'account.
    Usata per le API dashboard che operano a livello account (cross-evento).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante o non valido.")

    token = authorization.removeprefix("Bearer ").strip()

    if not _is_jwt(token):
        # Session token: prova a risalire all'account
        row = db.query_one(
            """
            SELECT u.account_id
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW() AND u.account_id IS NOT NULL
            """,
            (token,),
        )
        if not row or not row.get("account_id"):
            raise HTTPException(
                status_code=403,
                detail="Per accedere alla dashboard devi registrare il tuo account."
            )
        account_id = str(row["account_id"])
    else:
        payload = decode_jwt(token)
        if not payload or payload.get("type") != "account":
            raise HTTPException(status_code=401, detail="Token JWT non valido o scaduto.")
        account_id = payload["sub"]

    account = db.query_one("SELECT * FROM accounts WHERE id = %s", (account_id,))
    if not account:
        raise HTTPException(status_code=404, detail="Account non trovato.")

    return account
