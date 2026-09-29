"""
Dipendenza FastAPI per autenticare le richieste.
Legge il token dall'header Authorization: Bearer <token>
e ritorna l'utente corrente (con event_id e role) o solleva 401/403.
"""
from fastapi import Header, HTTPException, Depends
import db


def get_current_user(authorization: str = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante o non valido.")

    token = authorization.removeprefix("Bearer ").strip()

    row = db.query_one(
        """
        SELECT u.id, u.event_id, u.role, u.first_name, u.last_name, u.total_points
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
