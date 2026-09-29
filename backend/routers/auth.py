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
    is_couple: bool = False


def _normalize(s: str) -> str:
    """Lowercase + strip per uniformare le stringhe di identità."""
    return s.strip().lower()


@router.post("/login")
def login(body: LoginRequest):
    """
    Login o registrazione in un unico endpoint, sempre scoped a un evento.
    - invite_code non valido -> 404
    - Se is_couple:
        - Verifica se esiste account sposi per l'evento
        - Verifica la parola segreta
        - Se ok, autentica come sposi
    - Se non is_couple:
        - Cerca match esatto (guest o couple)
        - Se non trovato ma corrisponde alla parola segreta e al nome/cognome degli sposi, autentica come sposi
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

    couple_user = db.query_one(
        "SELECT * FROM users WHERE event_id = %s AND role = 'couple'",
        (event["id"],),
    )

    user = None
    is_new = False

    if body.is_couple:
        if not couple_user:
            raise HTTPException(status_code=404, detail="Nessun account sposi trovato per questo matrimonio.")

        if word != _normalize(couple_user["secret_word"]):
            raise HTTPException(
                status_code=401,
                detail="Parola segreta sposi non corretta. Inserisci la parola impostata durante la registrazione del matrimonio."
            )

        user = couple_user
        # Se lo sposo ha digitato nome o cognome con grafia corretta, aggiorniamo il record
        if first and last and (first != couple_user["first_name"] or last != couple_user["last_name"]):
            try:
                user = db.execute(
                    "UPDATE users SET first_name = %s, last_name = %s WHERE id = %s RETURNING *",
                    (first, last, couple_user["id"]),
                )
            except Exception:
                user = couple_user

    else:
        # Cerca utente identico esistente
        user = db.query_one(
            "SELECT * FROM users WHERE event_id = %s AND first_name = %s AND last_name = %s AND secret_word = %s",
            (event["id"], first, last, word),
        )

        # Se non trovato, verifica se sono gli sposi che stanno accedendo dal form generico
        if not user and couple_user:
            if word == _normalize(couple_user["secret_word"]):
                s1 = _normalize(event.get("spouse1_name") or "")
                s2 = _normalize(event.get("spouse2_name") or "")
                c_first = _normalize(couple_user["first_name"])
                c_last = _normalize(couple_user["last_name"])

                is_couple_match = (
                    first in (c_first, s1, s2)
                    or last in (c_last, s1, s2)
                    or (s1 and s1 in first)
                    or (s2 and s2 in first)
                    or (c_first and c_first in first)
                )

                if is_couple_match:
                    user = couple_user

        # Se ancora nessun utente, crea nuovo guest
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
