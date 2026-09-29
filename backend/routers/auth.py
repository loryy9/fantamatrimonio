"""
Rotte di autenticazione.
POST /api/auth/login  → login o registrazione automatica, scoped a un evento
GET  /api/auth/me     → dati utente + evento correnti dalla sessione
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import db
from serializers import event_out, user_out
from dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    invite_code: str
    first_name: str
    last_name: str
    secret_word: str


def _normalize(s: str) -> str:
    """Lowercase + strip per uniformare le stringhe di identità."""
    return s.strip().lower()


@router.post("/login")
def login(body: LoginRequest):
    """
    Login o registrazione in un unico endpoint, sempre scoped a un evento.
    - invite_code non valido -> 404
    - Se l'utente esiste in quell'evento (stesse credenziali normalizzate) -> login
    - Altrimenti -> crea account guest e fa login
    Ritorna: { token, is_new, user, event }
    """
    first = _normalize(body.first_name)
    last = _normalize(body.last_name)
    word = _normalize(body.secret_word)
    code = body.invite_code.strip().upper()

    if not first or not last or not word or not code:
        raise HTTPException(status_code=422, detail="Tutti i campi sono obbligatori.")

    event = db.query_one("SELECT * FROM events WHERE invite_code = %s", (code,))
    if not event:
        raise HTTPException(status_code=404, detail="Codice invito non valido.")

    user = db.query_one(
        "SELECT * FROM users WHERE event_id = %s AND first_name = %s AND last_name = %s AND secret_word = %s",
        (event["id"], first, last, word),
    )

    is_new = False
    if not user:
        is_new = True
        user = db.execute(
            """
            INSERT INTO users (event_id, role, first_name, last_name, secret_word)
            VALUES (%s, 'guest', %s, %s, %s)
            RETURNING *
            """,
            (event["id"], first, last, word),
        )

    token = str(uuid.uuid4())
    db.execute(
        "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
        (token, user["id"]),
    )

    return {
        "token": token,
        "is_new": is_new,
        "user": user_out(user),
        "event": event_out(event),
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    """Ritorna i dati aggiornati dell'utente e dell'evento correnti."""
    user = db.query_one(
        "SELECT id, event_id, role, first_name, last_name, total_points FROM users WHERE id = %s",
        (current_user["id"],),
    )
    event = db.query_one("SELECT * FROM events WHERE id = %s", (user["event_id"],))
    return {
        "user": user_out(user),
        "event": event_out(event),
    }
