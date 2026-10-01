"""
Rotte per la creazione e gestione degli eventi (matrimoni).
POST  /api/events            -> crea un nuovo matrimonio + account sposi
GET   /api/events/me         -> configurazione dell'evento corrente
PATCH /api/events/me         -> aggiorna la configurazione (solo sposi)
GET   /api/events/me/invite  -> codice invito dell'evento corrente
"""
import time
import uuid
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

import db
from invite_codes import generate_invite_code
from serializers import event_out, user_out
from dependencies import get_current_user, get_current_couple

router = APIRouter(prefix="/api/events", tags=["events"])

# Rate limit minimale in-memory: max 5 creazioni evento per IP ogni ora.
_creation_log: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW_SECONDS = 3600


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    recent = [t for t in _creation_log[ip] if now - t < _RATE_LIMIT_WINDOW_SECONDS]
    if len(recent) >= _RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Troppi matrimoni creati da questo indirizzo. Riprova più tardi.")
    recent.append(now)
    _creation_log[ip] = recent


def _normalize(s: str) -> str:
    return s.strip().lower()


class CreateEventRequest(BaseModel):
    spouse1_name: str
    spouse2_name: str
    enable_timer: bool = False
    start_time: datetime | None = None
    end_time: datetime | None = None
    couple_first_name: str
    couple_last_name: str
    couple_secret_word: str
    couple_email: str | None = None      # per registrazione sicura sposi
    couple_password: str | None = None   # per registrazione sicura sposi


@router.post("")
def create_event(body: CreateEventRequest, request: Request):
    _check_rate_limit(request.client.host if request.client else "unknown")

    if body.enable_timer and body.start_time and body.end_time and body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="L'orario di fine deve essere successivo a quello di inizio.")

    first = _normalize(body.couple_first_name)
    last = _normalize(body.couple_last_name)
    word = _normalize(body.couple_secret_word)
    if not body.spouse1_name.strip() or not body.spouse2_name.strip() or not first or not last or not word:
        raise HTTPException(status_code=422, detail="Tutti i campi sono obbligatori.")

    # Se email e password fornite, crea/verifica account sicuro per gli sposi
    couple_email = body.couple_email.strip().lower() if body.couple_email else None
    couple_password = body.couple_password if body.couple_password else None

    account_id = None
    jwt_token = None
    account_data = None

    if couple_email and couple_password:
        if len(couple_password) < 6:
            raise HTTPException(status_code=422, detail="La password deve essere di almeno 6 caratteri.")

        from dependencies import hash_password, create_jwt
        from serializers import account_out as _account_out

        existing_account = db.query_one("SELECT * FROM accounts WHERE email = %s", (couple_email,))
        if existing_account:
            raise HTTPException(status_code=409, detail="Esiste già un account con questa email.")

        account = db.execute(
            """
            INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
            VALUES (%s, %s, %s, FALSE, NOW())
            RETURNING *
            """,
            (couple_email, hash_password(couple_password),
             f"{body.spouse1_name.strip()} & {body.spouse2_name.strip()}"),
        )
        account_id = account["id"]
        jwt_token = create_jwt(str(account_id))
        account_data = _account_out(account)

    event = None
    user = None
    token = None
    for _ in range(5):
        code = generate_invite_code()
        try:
            with db.transaction() as cur:
                cur.execute(
                    """
                    INSERT INTO events (spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (body.spouse1_name.strip(), body.spouse2_name.strip(), body.enable_timer,
                     body.start_time, body.end_time, code),
                )
                event = dict(cur.fetchone())

                cur.execute(
                    """
                    INSERT INTO users (event_id, role, first_name, last_name, secret_word, account_id, email)
                    VALUES (%s, 'couple', %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (event["id"], first, last, word, account_id, couple_email),
                )
                user = dict(cur.fetchone())

                token = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO sessions (token, user_id, account_id) VALUES (%s, %s, %s)",
                    (token, user["id"], account_id),
                )
            break
        except Exception as e:
            if "invite_code" in str(e).lower():
                event = None
                continue
            raise
    if event is None:
        raise HTTPException(status_code=500, detail="Impossibile generare un codice invito univoco. Riprova.")

    result = {
        "token": token,
        "invite_code": event["invite_code"],
        "user": user_out(user),
        "event": event_out(event),
    }

    if jwt_token:
        result["jwt"] = jwt_token
    if account_data:
        result["account"] = account_data

    return result


@router.get("/me")
def get_my_event(current_user: dict = Depends(get_current_user)):
    event = db.query_one("SELECT * FROM events WHERE id = %s", (current_user["event_id"],))
    if not event:
        raise HTTPException(status_code=404, detail="Evento non trovato.")
    return event_out(event)


class UpdateEventRequest(BaseModel):
    spouse1_name: str | None = None
    spouse2_name: str | None = None
    enable_timer: bool | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None


@router.patch("/me")
def update_my_event(body: UpdateEventRequest, current_user: dict = Depends(get_current_couple)):
    event = db.query_one("SELECT * FROM events WHERE id = %s", (current_user["event_id"],))
    if not event:
        raise HTTPException(status_code=404, detail="Evento non trovato.")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return event_out(event)

    for required_field in ("spouse1_name", "spouse2_name", "enable_timer"):
        if required_field in updates and updates[required_field] is None:
            raise HTTPException(status_code=422, detail=f"Il campo '{required_field}' non può essere nullo.")

    merged_enable_timer = updates.get("enable_timer", event["enable_timer"])
    merged_start = updates.get("start_time", event["start_time"])
    merged_end = updates.get("end_time", event["end_time"])
    if merged_enable_timer and merged_start and merged_end and merged_end <= merged_start:
        raise HTTPException(status_code=422, detail="L'orario di fine deve essere successivo a quello di inizio.")

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [current_user["event_id"]]
    updated = db.execute(f"UPDATE events SET {set_clause} WHERE id = %s RETURNING *", params)
    return event_out(updated)


@router.get("/me/invite")
def get_my_invite_code(current_user: dict = Depends(get_current_user)):
    event = db.query_one("SELECT invite_code FROM events WHERE id = %s", (current_user["event_id"],))
    if not event:
        raise HTTPException(status_code=404, detail="Evento non trovato.")
    return {"invite_code": event["invite_code"]}


@router.get("/me/stats")
def get_my_event_stats(current_user: dict = Depends(get_current_couple)):
    """Statistiche per gli sposi: invitati registrati, foto caricate, quiz e momenti completati."""
    event_id = current_user["event_id"]
    guests_count = (db.query_one(
        "SELECT COUNT(*) AS count FROM users WHERE event_id = %s AND role = 'guest'",
        (event_id,)
    ) or {}).get("count", 0)

    photos_count = (db.query_one(
        """
        SELECT COUNT(s.*) AS count FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.event_id = %s AND c.type IN ('photo', 'hunt') AND s.image_url IS NOT NULL
        """,
        (event_id,)
    ) or {}).get("count", 0)

    quiz_count = (db.query_one(
        """
        SELECT COUNT(s.*) AS count FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.event_id = %s AND c.type = 'quiz'
        """,
        (event_id,)
    ) or {}).get("count", 0)

    moments_count = (db.query_one(
        """
        SELECT COUNT(s.*) AS count FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.event_id = %s AND c.type = 'vote'
        """,
        (event_id,)
    ) or {}).get("count", 0)

    return {
        "guests_count": guests_count,
        "photos_count": photos_count,
        "quiz_count": quiz_count,
        "moments_count": moments_count
    }


@router.delete("/me")
def cancel_and_delete_my_event(current_user: dict = Depends(get_current_couple)):
    """
    Consente agli sposi di annullare la creazione o eliminare definitivamente
    il loro matrimonio e tutti i record associati dal database (CASCADE).
    """
    event_id = current_user["event_id"]
    event = db.query_one("SELECT id, spouse1_name, spouse2_name, invite_code FROM events WHERE id = %s", (event_id,))
    if not event:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato.")

    db.execute("DELETE FROM events WHERE id = %s", (event_id,))
    return {
        "success": True,
        "message": f"Matrimonio di {event['spouse1_name']} & {event['spouse2_name']} eliminato definitivamente dal database."
    }

