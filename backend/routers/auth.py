"""
Rotte di autenticazione.
POST /api/auth/login          → login leggero (nome + cognome + parola + email opzionale)
POST /api/auth/register       → registrazione sicura (email + password) — per sposi o post-festa
POST /api/auth/login-secure   → login con email + password → JWT
POST /api/auth/upgrade        → ospite collega il suo user a un account
GET  /api/auth/me             → dati utente + evento correnti dalla sessione
"""

import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header, Query
from pydantic import BaseModel, EmailStr

import db
from serializers import event_out, user_out, account_out
from dependencies import (
    get_current_user,
    get_current_account,
    hash_password,
    verify_password,
    create_jwt,
)
from config import REGISTRATION_REMINDER_DAYS

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    invite_code: str
    first_name: str
    last_name: str
    secret_word: str
    is_couple: bool = False
    email: str | None = None  # opzionale per ospiti


class SendVerificationCodeRequest(BaseModel):
    email: str
    purpose: str = "registration"  # 'register_couple', 'register_account', 'upgrade_account'


class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    purpose: str = "registration"


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str
    verification_code: str | None = None


class LoginSecureRequest(BaseModel):
    email: str
    password: str


class UpgradeRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None
    verification_code: str | None = None


class ClaimInfoRequest(BaseModel):
    claim_token: str


class CompleteClaimRequest(BaseModel):
    claim_token: str
    password: str
    display_name: str | None = None


from verification import create_and_send_code, verify_code, normalize_email


def _normalize(s: str) -> str:
    """Lowercase + strip per uniformare le stringhe di identità."""
    return s.strip().lower()


@router.post("/login")
def login(body: LoginRequest, background_tasks: BackgroundTasks):
    """
    Login o registrazione in un unico endpoint, sempre scoped a un evento.
    Ora supporta anche email opzionale per il reminder post-festa.
    """
    first = _normalize(body.first_name)
    last = _normalize(body.last_name)
    word = _normalize(body.secret_word)
    code = body.invite_code.strip().upper()
    email = body.email.strip().lower() if body.email else None

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
                INSERT INTO users (event_id, role, first_name, last_name, secret_word, email)
                VALUES (%s, 'guest', %s, %s, %s, %s)
                RETURNING *
                """,
                (event["id"], first, last, word, email),
            )

            # Se l'ospite ha lasciato l'email, programma il reminder
            if email:
                send_after = datetime.now(timezone.utc) + timedelta(days=REGISTRATION_REMINDER_DAYS)
                db.execute(
                    """
                    INSERT INTO registration_reminders (user_id, event_id, email, send_after)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user["id"], event["id"], email, send_after),
                )
                if REGISTRATION_REMINDER_DAYS <= 0:
                    from email_service import process_due_reminders
                    background_tasks.add_task(process_due_reminders)
        else:
            # Utente esistente: aggiorna email se fornita e non presente
            if email and not user.get("email"):
                db.execute(
                    "UPDATE users SET email = %s WHERE id = %s",
                    (email, user["id"]),
                )
                # Programma reminder se non ce n'è già uno
                existing_reminder = db.query_one(
                    "SELECT id FROM registration_reminders WHERE user_id = %s AND event_id = %s",
                    (user["id"], event["id"]),
                )
                if not existing_reminder:
                    send_after = datetime.now(timezone.utc) + timedelta(days=REGISTRATION_REMINDER_DAYS)
                    db.execute(
                        """
                        INSERT INTO registration_reminders (user_id, event_id, email, send_after)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (user["id"], event["id"], email, send_after),
                    )
                    if REGISTRATION_REMINDER_DAYS <= 0:
                        from email_service import process_due_reminders
                        background_tasks.add_task(process_due_reminders)


    # Genera session token (manteniamo il flusso attuale)
    token = str(uuid.uuid4())
    db.execute(
        "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
        (token, user["id"]),
    )

    result = {
        "token": token,
        "is_new": is_new,
        "user": user_out(user),
        "event": event_out(event),
    }

    # Se l'utente ha un account collegato, aggiungiamo anche il JWT
    if user.get("account_id"):
        result["jwt"] = create_jwt(str(user["account_id"]))
        account = db.query_one("SELECT * FROM accounts WHERE id = %s", (user["account_id"],))
        if account:
            result["account"] = account_out(account)

    return result


@router.post("/send-verification-code")
def send_code(body: SendVerificationCodeRequest):
    """Invia il codice di verifica a 6 cifre via email prima di completare la registrazione."""
    email = normalize_email(body.email)
    if body.purpose in ("register_couple", "register_account"):
        existing = db.query_one("SELECT id FROM accounts WHERE email = %s", (email,))
        if existing and body.purpose == "register_account":
            raise HTTPException(status_code=409, detail="Esiste già un account con questa email. Prova ad accedere.")
    return create_and_send_code(email, body.purpose)


@router.post("/verify-code")
def check_code(body: VerifyCodeRequest):
    """Verifica la correttezza del codice senza consumarlo."""
    valid = verify_code(body.email, body.code, body.purpose, mark_used=False)
    if not valid:
        raise HTTPException(status_code=400, detail="Codice di verifica non valido o scaduto.")
    return {"valid": True, "message": "Codice verificato con successo."}


@router.post("/register")
def register(body: RegisterRequest):
    """
    Registrazione sicura: crea un account con email + password.
    Verifica il codice a 6 cifre ricevuto via email.
    """
    email = body.email.strip().lower()
    if not email or not body.password or len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Email e password (min 6 caratteri) sono obbligatori.")

    is_verified = False
    if body.verification_code:
        valid = verify_code(email, body.verification_code, "register_account", mark_used=True)
        if not valid:
            raise HTTPException(status_code=400, detail="Codice di verifica non valido o scaduto.")
        is_verified = True
    else:
        raise HTTPException(status_code=400, detail="Il codice di verifica inviato via email è obbligatorio.")

    existing = db.query_one("SELECT id FROM accounts WHERE email = %s", (email,))
    if existing:
        raise HTTPException(status_code=409, detail="Esiste già un account con questa email.")

    account = db.execute(
        """
        INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
        VALUES (%s, %s, %s, %s, NOW())
        RETURNING *
        """,
        (email, hash_password(body.password), body.display_name.strip(), is_verified),
    )

    jwt_token = create_jwt(str(account["id"]))

    return {
        "jwt": jwt_token,
        "account": account_out(account),
    }


@router.post("/login-secure")
def login_secure(body: LoginSecureRequest):
    """
    Login con email + password. Ritorna JWT + account + lista eventi.
    """
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=422, detail="Email e password sono obbligatori.")

    account = db.query_one("SELECT * FROM accounts WHERE email = %s", (email,))
    if not account or not account.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email o password non corretti.")

    if not verify_password(body.password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti.")

    jwt_token = create_jwt(str(account["id"]))

    # Cerca tutti gli eventi dell'account
    events = db.query(
        """
        SELECT DISTINCT e.* FROM events e
        JOIN users u ON u.event_id = e.id
        WHERE u.account_id = %s
        ORDER BY e.created_at DESC
        """,
        (account["id"],),
    )

    return {
        "jwt": jwt_token,
        "account": account_out(account),
        "events": [event_out(ev) for ev in events],
    }


@router.post("/upgrade")
def upgrade_account(body: UpgradeRequest, current_user: dict = Depends(get_current_user)):
    """
    Un utente con session token può "upgradare" creando un account permanente.
    Collega il suo user corrente (e tutti i suoi user con la stessa email) all'account.
    """
    email = body.email.strip().lower()
    if not email or not body.password or len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Email e password (min 6 caratteri) sono obbligatori.")

    is_verified = False
    if body.verification_code:
        valid = verify_code(email, body.verification_code, "upgrade_account", mark_used=True)
        if not valid:
            raise HTTPException(status_code=400, detail="Codice di verifica non valido o scaduto.")
        is_verified = True

    # Controlla se esiste già un account con questa email
    existing = db.query_one("SELECT * FROM accounts WHERE email = %s", (email,))

    if existing:
        # Se esiste, verifica la password e collega
        if not existing.get("password_hash"):
            raise HTTPException(status_code=409, detail="Account già esistente ma non completamente registrato.")
        if not verify_password(body.password, existing["password_hash"]):
            raise HTTPException(status_code=401, detail="Password non corretta per questo account.")
        account = existing
        if is_verified:
            db.execute("UPDATE accounts SET is_verified = TRUE WHERE id = %s", (account["id"],))
    else:
        # Crea nuovo account
        display = body.display_name or f"{current_user['first_name']} {current_user['last_name']}"
        account = db.execute(
            """
            INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING *
            """,
            (email, hash_password(body.password), display.strip(), is_verified),
        )

    # Collega il user corrente all'account
    db.execute(
        "UPDATE users SET account_id = %s WHERE id = %s AND account_id IS NULL",
        (account["id"], current_user["id"]),
    )

    # Collega anche altri user con la stessa email
    if email:
        db.execute(
            "UPDATE users SET account_id = %s WHERE email = %s AND account_id IS NULL",
            (account["id"], email),
        )

    jwt_token = create_jwt(str(account["id"]))

    return {
        "jwt": jwt_token,
        "account": account_out(account),
        "user": user_out(current_user),
    }


@router.post("/claim-info")
def get_claim_info(body: ClaimInfoRequest):
    """
    Risolve il link di reminder/recupero inviato via email.
    Ritorna i dati dell'ospite (nome, email, evento) e riattiva la sua sessione in gioco,
    in modo che possa confermare la password e collegare l'account permanente.
    """
    from dependencies import decode_jwt
    payload = decode_jwt(body.claim_token)
    if not payload or payload.get("type") != "claim_guest":
        raise HTTPException(status_code=400, detail="Il link di recupero non è valido o è scaduto.")

    user_id = payload.get("sub")
    event_id = payload.get("event_id")
    email = (payload.get("email") or "").strip().lower()

    user = db.query_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="Profilo utente non trovato.")

    event = db.query_one("SELECT * FROM events WHERE id = %s", (event_id or user.get("event_id"),))

    # Cerca se l'utente ha già un account permanente registrato
    account = None
    if user.get("account_id"):
        account = db.query_one("SELECT * FROM accounts WHERE id = %s", (user["account_id"],))
    elif email:
        account = db.query_one("SELECT * FROM accounts WHERE email = %s", (email,))

    # Genera o recupera un session token attivo per riaccedere istantaneamente alla festa
    sess = db.query_one(
        "SELECT token FROM sessions WHERE user_id = %s AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
        (user["id"],),
    )
    if sess:
        session_token = sess["token"]
    else:
        import uuid
        session_token = str(uuid.uuid4())
        db.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')",
            (user["id"], session_token),
        )

    # Se l'account è già completamente registrato (ha password_hash), genera direttamente il JWT
    if account and account.get("password_hash"):
        jwt_token = create_jwt(str(account["id"]))
        return {
            "valid": True,
            "already_registered": True,
            "jwt": jwt_token,
            "account": account_out(account),
            "user": user_out(user),
            "event": event_out(event) if event else None,
            "token": session_token,
        }

    first = user.get("first_name") or ""
    last = user.get("last_name") or ""
    display_name = f"{first} {last}".strip()

    return {
        "valid": True,
        "already_registered": False,
        "email": email or user.get("email") or "",
        "first_name": first,
        "last_name": last,
        "display_name": display_name,
        "event": event_out(event) if event else None,
        "user": user_out(user),
        "token": session_token,
    }


@router.post("/complete-claim")
def complete_claim(body: CompleteClaimRequest):
    """
    Completa la registrazione dell'account dal link di invito/reminder via email:
    l'email è già verificata (poiché aperta dal link firmato).
    Salva la password, collega l'utente e restituisce JWT e sessione per la dashboard.
    """
    from dependencies import decode_jwt, hash_password
    payload = decode_jwt(body.claim_token)
    if not payload or payload.get("type") != "claim_guest":
        raise HTTPException(status_code=400, detail="Il link di recupero non è valido o è scaduto.")

    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=422, detail="La password deve contenere almeno 6 caratteri.")

    user_id = payload.get("sub")
    event_id = payload.get("event_id")
    email = (payload.get("email") or "").strip().lower()

    user = db.query_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="Profilo utente non trovato.")

    if not email and user.get("email"):
        email = user["email"].strip().lower()

    if not email:
        raise HTTPException(status_code=422, detail="Email non associata a questo invito.")

    first = user.get("first_name") or ""
    last = user.get("last_name") or ""
    default_name = f"{first} {last}".strip() or "Invitato"
    display = (body.display_name or "").strip() or default_name

    # Controlla se esiste già un account con questa email
    existing = db.query_one("SELECT * FROM accounts WHERE email = %s", (email,))
    if existing:
        db.execute(
            """
            UPDATE accounts
            SET password_hash = %s, display_name = %s, is_verified = TRUE
            WHERE id = %s
            """,
            (hash_password(body.password), display, existing["id"]),
        )
        account = db.query_one("SELECT * FROM accounts WHERE id = %s", (existing["id"],))
    else:
        account = db.execute(
            """
            INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
            VALUES (%s, %s, %s, TRUE, NOW())
            RETURNING *
            """,
            (email, hash_password(body.password), display),
        )

    # Collega il profilo user all'account permanente
    db.execute("UPDATE users SET account_id = %s WHERE id = %s", (account["id"], user["id"]))
    db.execute("UPDATE users SET account_id = %s WHERE email = %s AND account_id IS NULL", (account["id"], email))

    # Segna reminder come inviato/completato
    db.execute("UPDATE registration_reminders SET sent_at = NOW() WHERE email = %s", (email,))

    # Session token per la festa
    sess = db.query_one(
        "SELECT token FROM sessions WHERE user_id = %s AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
        (user["id"],),
    )
    if sess:
        session_token = sess["token"]
    else:
        import uuid
        session_token = str(uuid.uuid4())
        db.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')",
            (user["id"], session_token),
        )

    jwt_token = create_jwt(str(account["id"]))
    event = db.query_one("SELECT * FROM events WHERE id = %s", (event_id or user.get("event_id"),))

    return {
        "jwt": jwt_token,
        "account": account_out(account),
        "user": user_out(user),
        "event": event_out(event) if event else None,
        "token": session_token,
    }


@router.get("/me")
def me(
    authorization: str = Header(default=None),
    event_id: str = Query(default=None, alias="event_id"),
):
    """Ritorna i dati aggiornati dell'utente, dell'evento e dell'account corrente."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante o non valido.")

    token = authorization.removeprefix("Bearer ").strip()

    # Se JWT (account permanente)
    if token.count(".") == 2:
        from dependencies import decode_jwt
        payload = decode_jwt(token)
        if not payload or payload.get("type") != "account":
            raise HTTPException(status_code=401, detail="Token JWT non valido o scaduto.")

        account_id = payload["sub"]
        account = db.query_one("SELECT * FROM accounts WHERE id = %s", (account_id,))
        if not account:
            raise HTTPException(status_code=404, detail="Account non trovato.")

        user = None
        event = None

        if event_id:
            user = db.query_one(
                "SELECT * FROM users WHERE account_id = %s AND event_id = %s",
                (account_id, event_id),
            )
        else:
            user = db.query_one(
                "SELECT * FROM users WHERE account_id = %s ORDER BY created_at DESC LIMIT 1",
                (account_id,),
            )

        session_token = None
        if user:
            event = db.query_one("SELECT * FROM events WHERE id = %s", (user["event_id"],))
            sess = db.query_one(
                "SELECT token FROM sessions WHERE user_id = %s AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
                (user["id"],),
            )
            if sess:
                session_token = sess["token"]
            else:
                import uuid
                session_token = str(uuid.uuid4())
                db.execute(
                    "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')",
                    (user["id"], session_token),
                )

        return {
            "account": account_out(account),
            "user": user_out(user) if user else None,
            "event": event_out(event) if event else None,
            "token": session_token,
        }

    # Se session token UUID (ospite temporaneo)
    else:
        row = db.query_one(
            """
            SELECT u.*
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()
            """,
            (token,),
        )
        if not row:
            raise HTTPException(status_code=401, detail="Sessione scaduta o non trovata.")

        event = db.query_one("SELECT * FROM events WHERE id = %s", (row["event_id"],))
        account = None
        if row.get("account_id"):
            account = db.query_one("SELECT * FROM accounts WHERE id = %s", (row["account_id"],))

        return {
            "user": user_out(row),
            "event": event_out(event) if event else None,
            "account": account_out(account) if account else None,
        }
