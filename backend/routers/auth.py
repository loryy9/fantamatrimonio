"""
Rotte di autenticazione.
POST /api/auth/login  → login o registrazione automatica
GET  /api/auth/me     → dati utente corrente dalla sessione
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    first_name: str
    last_name: str
    secret_word: str


def _normalize(s: str) -> str:
    """Lowercase + strip per uniformare le stringhe di identità."""
    return s.strip().lower()


@router.post("/login")
def login(body: LoginRequest):
    """
    Login o registrazione in un unico endpoint.
    - Se l'utente esiste (stesse credenziali normalizzate) → login
    - Altrimenti → crea account e fa login
    Ritorna: { token, user }
    """
    first = _normalize(body.first_name)
    last = _normalize(body.last_name)
    word = _normalize(body.secret_word)

    if not first or not last or not word:
        raise HTTPException(status_code=422, detail="Tutti i campi sono obbligatori.")

    # Cerca utente esistente
    user = db.query_one(
        "SELECT * FROM users WHERE first_name = %s AND last_name = %s AND secret_word = %s",
        (first, last, word),
    )

    is_new = False
    # Non esiste → registrazione automatica
    if not user:
        is_new = True
        user = db.execute(
            """
            INSERT INTO users (first_name, last_name, secret_word)
            VALUES (%s, %s, %s)
            RETURNING *
            """,
            (first, last, word),
        )

    # Crea sessione (30 giorni)
    token = str(uuid.uuid4())
    db.execute(
        "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
        (token, user["id"]),
    )

    return {
        "token": token,
        "is_new": is_new,
        "user": {
            "id": str(user["id"]),
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "total_points": user["total_points"],
        },
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    """Ritorna i dati aggiornati dell'utente autenticato."""
    # Re-fetch per avere total_points sempre fresco
    user = db.query_one(
        "SELECT id, first_name, last_name, total_points FROM users WHERE id = %s",
        (current_user["id"],),
    )
    return {
        "user": {
            "id": str(user["id"]),
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "total_points": user["total_points"],
        }
    }

