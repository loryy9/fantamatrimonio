"""
Router per le funzionalita' di amministrazione globale della piattaforma.
Accesso protetto da credenziali admin (username: admin, password: admin).
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
ADMIN_SECRET_KEY = os.environ.get("ADMIN_SECRET_KEY", "fanta-matrimonio-admin-secret-key-2026")


def create_admin_token(username: str) -> str:
    # Token valido per 7 giorni
    exp = int(time.time()) + (86400 * 7)
    payload = json.dumps({"u": username, "exp": exp, "role": "global_admin"})
    b64_payload = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    sig = hmac.new(ADMIN_SECRET_KEY.encode(), b64_payload.encode(), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"


def verify_admin_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("Token malformato")
        b64_payload, sig = parts
        expected_sig = hmac.new(ADMIN_SECRET_KEY.encode(), b64_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Firma non valida")
        # Padding base64
        padded = b64_payload + "=" * (-len(b64_payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        if data.get("exp", 0) < int(time.time()):
            raise ValueError("Token scaduto")
        return data
    except Exception:
        raise HTTPException(status_code=401, detail="Sessione amministratore non valida o scaduta.")


def get_current_admin(
    authorization: str = Header(default=None),
    x_admin_token: str = Header(default=None),
) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    elif x_admin_token:
        token = x_admin_token.strip()

    if not token:
        raise HTTPException(status_code=401, detail="Autenticazione amministratore richiesta.")

    return verify_admin_token(token)


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def admin_login(body: AdminLoginRequest):
    """Autentica l'amministratore di sistema."""
    if (
        body.username.strip() != ADMIN_USERNAME
        or body.password != ADMIN_PASSWORD
    ):
        raise HTTPException(status_code=401, detail="Nome utente o password admin errati.")

    token = create_admin_token(body.username.strip())
    logger.info("Accesso admin effettuato con successo.")
    return {
        "token": token,
        "username": body.username.strip(),
        "role": "global_admin",
    }


@router.get("/verify")
def admin_verify(admin: dict = Depends(get_current_admin)):
    """Verifica se il token admin in sessione e' ancora valido."""
    return {"valid": True, "username": admin.get("u", "admin")}


@router.get("/events")
def list_all_events(admin: dict = Depends(get_current_admin)):
    """
    Ritorna la lista di tutti i matrimoni nel database con relative
    statistiche (invitati, sfide, submission, foto, date inizio/fine).
    """
    rows = db.query(
        """
        SELECT 
            e.id,
            e.spouse1_name,
            e.spouse2_name,
            e.invite_code,
            e.start_time,
            e.end_time,
            e.enable_timer,
            e.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.event_id = e.id) AS guest_count,
            (SELECT COUNT(*) FROM challenges c WHERE c.event_id = e.id) AS challenge_count,
            (SELECT COUNT(*) FROM user_submissions s JOIN users u ON u.id = s.user_id WHERE u.event_id = e.id) AS submission_count,
            (SELECT COUNT(*) FROM user_submissions s JOIN users u ON u.id = s.user_id WHERE u.event_id = e.id AND s.image_url IS NOT NULL AND s.image_url != '') AS photo_count
        FROM events e
        ORDER BY e.created_at DESC;
        """
    )

    events_data = []
    for r in rows:
        events_data.append({
            "id": str(r["id"]),
            "spouse1_name": r["spouse1_name"],
            "spouse2_name": r["spouse2_name"],
            "invite_code": r.get("invite_code") or "",
            "enable_timer": bool(r.get("enable_timer")),
            "start_time": r["start_time"].isoformat() if r["start_time"] else None,
            "end_time": r["end_time"].isoformat() if r["end_time"] else None,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "guest_count": r.get("guest_count", 0),
            "challenge_count": r.get("challenge_count", 0),
            "submission_count": r.get("submission_count", 0),
            "photo_count": r.get("photo_count", 0),
        })

    return {"events": events_data}


@router.delete("/events/{event_id}")
def delete_event(event_id: str, admin: dict = Depends(get_current_admin)):
    """
    Elimina un matrimonio e, per CASCADE di database,
    cancella tutti gli invitati, le sfide, i voti, le foto e le sessioni associate.
    """
    existing = db.query_one(
        "SELECT id, spouse1_name, spouse2_name, invite_code FROM events WHERE id = %s",
        (event_id,),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato.")

    db.execute("DELETE FROM events WHERE id = %s", (event_id,))
    logger.info(f"Matrimonio {event_id} ({existing['spouse1_name']} & {existing['spouse2_name']}) eliminato dall'amministratore.")

    return {
        "success": True,
        "message": f"Matrimonio di {existing['spouse1_name']} & {existing['spouse2_name']} (Codice: {existing['invite_code']}) eliminato definitivamente.",
    }


@router.post("/reminders/process")
def trigger_reminders(admin: dict = Depends(get_current_admin)):
    """
    Attiva manualmente l'invio delle email di reminder per gli ospiti.
    Utile per testare l'invio o per cron webhook esterni.
    """
    from email_service import process_due_reminders
    result = process_due_reminders()
    return {
        "success": True,
        "summary": result,
    }


@router.get("/users")
def list_all_users(admin: dict = Depends(get_current_admin)):
    """
    Ritorna la lista di tutti gli account utente registrati nel database,
    con info sui matrimoni creati (sposi) o a cui partecipano (invitati).
    """
    rows = db.query(
        """
        SELECT 
            a.id,
            a.email,
            a.display_name,
            a.is_verified,
            a.registered_at,
            a.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id AND u.role = 'couple') AS weddings_as_couple,
            (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id AND u.role = 'guest') AS weddings_as_guest,
            (
                SELECT json_agg(json_build_object(
                    'event_id', e.id,
                    'role', u.role,
                    'spouse1_name', e.spouse1_name,
                    'spouse2_name', e.spouse2_name,
                    'invite_code', e.invite_code,
                    'total_points', u.total_points
                ))
                FROM users u
                JOIN events e ON e.id = u.event_id
                WHERE u.account_id = a.id
            ) AS events
        FROM accounts a
        ORDER BY a.created_at DESC;
        """
    )

    users_data = []
    for r in rows:
        users_data.append({
            "id": str(r["id"]),
            "email": r["email"] or "",
            "display_name": r["display_name"] or "",
            "is_verified": bool(r.get("is_verified")),
            "registered_at": r["registered_at"].isoformat() if r["registered_at"] else None,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "weddings_as_couple": r.get("weddings_as_couple", 0),
            "weddings_as_guest": r.get("weddings_as_guest", 0),
            "events": r.get("events") or [],
        })

    return {"users": users_data}


@router.delete("/users/{account_id}")
def delete_account(
    account_id: str,
    delete_events: bool = False,
    admin: dict = Depends(get_current_admin)
):
    """
    Elimina un account registrato.
    Se delete_events=True, cancella anche i matrimoni creati da questo utente come sposo.
    Altrimenti, disassocia o rimuove l'account lasciando intatti i dati del matrimonio.
    """
    existing = db.query_one(
        "SELECT id, email, display_name FROM accounts WHERE id = %s",
        (account_id,),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Utente / account non trovato.")

    # Trova eventuali matrimoni creati come sposo
    owned_events = db.query(
        """
        SELECT e.id, e.spouse1_name, e.spouse2_name
        FROM events e
        JOIN users u ON u.event_id = e.id
        WHERE u.account_id = %s AND u.role = 'couple'
        """,
        (account_id,),
    )

    with db.transaction() as cur:
        if delete_events and owned_events:
            for ev in owned_events:
                cur.execute("DELETE FROM events WHERE id = %s", (ev["id"],))

        # Rimuovi reminder pendenti collegati all'utente
        cur.execute(
            """
            DELETE FROM registration_reminders
            WHERE user_id IN (SELECT id FROM users WHERE account_id = %s)
            """,
            (account_id,),
        )
        # Cancella sessioni collegate
        cur.execute("DELETE FROM sessions WHERE account_id = %s", (account_id,))
        # Cancella profili guest collegati a questo account
        cur.execute("DELETE FROM users WHERE account_id = %s AND role = 'guest'", (account_id,))
        # Per eventuali profili sposi rimasti (se l'evento non è stato cancellato), disassocia account
        cur.execute("UPDATE users SET account_id = NULL WHERE account_id = %s", (account_id,))
        # Cancella l'account
        cur.execute("DELETE FROM accounts WHERE id = %s", (account_id,))

    logger.info(f"Account {account_id} ({existing['email']}) eliminato dall'amministratore.")
    return {
        "success": True,
        "message": f"Account {existing['email']} ({existing['display_name']}) eliminato definitivamente.",
    }
