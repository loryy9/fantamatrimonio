"""
Rotte per le submission degli utenti.

POST /api/submissions/photo              → upload foto gallery (type=photo)
POST /api/submissions/hunt/{id}          → upload foto missione caccia (type=hunt)
POST /api/submissions/vote/{id}          → vota un'opzione (type=vote, upsert)
POST /api/submissions/quiz/{id}          → rispondi al quiz (type=quiz)
GET  /api/submissions/gallery            → galleria pubblica (no auth)
GET  /api/submissions/mine               → submission dell'utente corrente
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import db
import storage
from dependencies import get_current_user

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

# Dimensione massima upload di sicurezza: 50 MB (per non bloccare mai nessun utente)
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}

# Cache in-memory per le challenge fotografiche statiche per evitare query ripetute a ogni upload
_PHOTO_CHALLENGE_CACHE = {}


def _get_photo_challenge(award_points: bool) -> dict | None:
    cache_key = "award" if award_points else "no_award"
    if cache_key in _PHOTO_CHALLENGE_CACHE:
        return _PHOTO_CHALLENGE_CACHE[cache_key]

    if award_points:
        photo_challenge = db.query_one(
            "SELECT * FROM challenges WHERE type = 'photo' AND points > 0 AND active = TRUE ORDER BY id ASC LIMIT 1"
        )
    else:
        photo_challenge = db.query_one(
            "SELECT * FROM challenges WHERE type = 'photo' AND points = 0 AND active = TRUE ORDER BY id ASC LIMIT 1"
        )

    if not photo_challenge:
        photo_challenge = db.query_one(
            "SELECT * FROM challenges WHERE type = 'photo' AND active = TRUE ORDER BY id ASC LIMIT 1"
        )

    if photo_challenge:
        _PHOTO_CHALLENGE_CACHE[cache_key] = photo_challenge

    return photo_challenge


def _get_active_challenge(challenge_id: int, expected_type: str) -> dict:
    """Helper: recupera la challenge e valida che sia attiva e del tipo corretto."""
    c = db.query_one(
        "SELECT * FROM challenges WHERE id = %s AND active = TRUE",
        (challenge_id,),
    )
    if not c:
        raise HTTPException(status_code=404, detail="Sfida non trovata o non attiva.")
    if c["type"] != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo di sfida non valido: atteso '{expected_type}', trovato '{c['type']}'.",
        )
    return c


async def _read_and_validate_upload(file: UploadFile) -> bytes:
    """Legge il file in memoria verificando dimensione e content-type."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Formato non supportato: {file.content_type}. Usa JPEG, PNG o WebP.",
        )
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande. Dimensione massima: {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )
    return data


# ── GALLERY (type=photo) ─────────────────────────────────────────────────────

@router.post("/photo")
async def upload_gallery_photo(
    award_points: bool = True,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Carica una singola foto nella gallery.
    """
    photo_challenge = _get_photo_challenge(award_points)
    if not photo_challenge:
        raise HTTPException(status_code=404, detail="Gallery non disponibile.")

    data = await _read_and_validate_upload(file)
    url = await asyncio.to_thread(storage.upload_photo, data, file.content_type)

    submission = await asyncio.to_thread(
        db.execute,
        """
        INSERT INTO user_submissions (user_id, challenge_id, image_url)
        VALUES (%s, %s, %s)
        RETURNING id, image_url, created_at
        """,
        (current_user["id"], photo_challenge["id"], url),
    )

    pts = photo_challenge["points"] if award_points else 0

    return {
        "id": str(submission["id"]),
        "image_url": submission["image_url"],
        "points_awarded": pts,
        "user": {
            "first_name": current_user["first_name"],
            "last_name": current_user["last_name"],
        },
    }


@router.post("/photos")
async def upload_multiple_gallery_photos(
    award_points: bool = True,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Carica più foto contemporaneamente nella gallery (selezione multipla da smartphone).
    Assegna punti per ogni foto caricata (se i giochi sono aperti).
    Gli upload su storage avvengono in parallelo con asyncio.gather per la massima velocità.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file selezionato.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Puoi caricare al massimo 10 foto alla volta.")

    photo_challenge = _get_photo_challenge(award_points)
    if not photo_challenge:
        raise HTTPException(status_code=404, detail="Gallery non disponibile.")

    # 1. Legge e valida tutti i file in memoria
    file_payloads = []
    for f in files:
        data = await _read_and_validate_upload(f)
        file_payloads.append((data, f.content_type))

    # 2. Upload parallelo verso Supabase Storage
    async def _upload_one(data, ctype):
        return await asyncio.to_thread(storage.upload_photo, data, ctype)

    urls = await asyncio.gather(*[_upload_one(d, c) for d, c in file_payloads])

    # 3. Inserimento record nel DB (il trigger PostgreSQL aggiornerà i punti per ogni foto)
    pts_per_photo = photo_challenge["points"] if award_points else 0

    def _insert_all():
        inserted = []
        for url in urls:
            sub = db.execute(
                """
                INSERT INTO user_submissions (user_id, challenge_id, image_url)
                VALUES (%s, %s, %s)
                RETURNING id, image_url, created_at
                """,
                (current_user["id"], photo_challenge["id"], url),
            )
            inserted.append(sub)
        return inserted

    submissions = await asyncio.to_thread(_insert_all)

    return {
        "count": len(submissions),
        "points_per_photo": pts_per_photo,
        "total_points_awarded": pts_per_photo * len(submissions),
        "submissions": [
            {
                "id": str(s["id"]),
                "image_url": s["image_url"],
                "points_awarded": pts_per_photo,
            }
            for s in submissions
        ],
        "user": {
            "first_name": current_user["first_name"],
            "last_name": current_user["last_name"],
        },
    }


@router.delete("/photo/{submission_id}")
async def delete_gallery_photo(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Elimina una foto dalla gallery (solo se caricata dall'utente corrente).
    Il trigger del database scala automaticamente i punti assegnati (es. -10 PT).
    """
    sub = db.query_one(
        "SELECT * FROM user_submissions WHERE id = %s",
        (submission_id,),
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Foto non trovata.")
    if str(sub["user_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Non puoi eliminare le foto di altri utenti.")

    # Elimina record dal database
    db.execute("DELETE FROM user_submissions WHERE id = %s", (submission_id,))

    # Elimina file dallo storage Supabase
    if sub.get("image_url"):
        await asyncio.to_thread(storage.delete_photo, sub["image_url"])

    return {"success": True, "deleted_id": str(submission_id)}


# ── CACCIA FOTOGRAFICA (type=hunt) ───────────────────────────────────────────

@router.post("/hunt/{challenge_id}")
async def submit_hunt_photo(
    challenge_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Invia la foto per una missione della caccia fotografica.
    Ogni missione può essere completata una sola volta per utente.
    """
    challenge = _get_active_challenge(challenge_id, "hunt")

    # Controlla se l'utente ha già completato questa missione
    already_done = db.query_one(
        "SELECT id FROM user_submissions WHERE user_id = %s AND challenge_id = %s",
        (current_user["id"], challenge_id),
    )
    if already_done:
        raise HTTPException(status_code=409, detail="Hai già completato questa missione!")

    data = await _read_and_validate_upload(file)
    url = await asyncio.to_thread(storage.upload_photo, data, file.content_type)

    submission = await asyncio.to_thread(
        db.execute,
        """
        INSERT INTO user_submissions (user_id, challenge_id, image_url)
        VALUES (%s, %s, %s)
        RETURNING id, image_url, created_at
        """,
        (current_user["id"], challenge_id, url),
    )

    return {
        "id": str(submission["id"]),
        "image_url": submission["image_url"],
        "points_awarded": challenge["points"],
        "message": "Missione completata! Punti assegnati.",
    }


# ── VOTO (type=vote) ─────────────────────────────────────────────────────────

class VoteRequest(BaseModel):
    option: str = None
    option_id: str = None
    text: str = None
    answer: str = None

    def get_chosen_option(self) -> str:
        val = self.text or self.answer or self.option or self.option_id or ""
        return val.strip()


@router.post("/vote/{challenge_id}")
def submit_vote(
    challenge_id: int,
    body: VoteRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Vota un'opzione o invia testo libero. Sovrascrive il voto/testo precedente (upsert).
    Conta sempre l'ultimo inviato.
    """
    chosen_opt = body.get_chosen_option()
    if not chosen_opt:
        raise HTTPException(status_code=422, detail="Inserisci una risposta valida prima di inviare.")

    challenge = _get_active_challenge(challenge_id, "vote")

    # Controlla se esiste già un voto
    existing = db.query_one(
        "SELECT id FROM user_submissions WHERE user_id = %s AND challenge_id = %s",
        (current_user["id"], challenge_id),
    )

    if existing:
        # Aggiorna il testo/voto esistente
        db.execute(
            "UPDATE user_submissions SET answer_text = %s WHERE id = %s",
            (chosen_opt, existing["id"]),
        )
        return {"message": "Momento aggiornato con successo!", "option": chosen_opt, "points_awarded": 0, "status": "updated"}
    else:
        # Primo invio → INSERT con punti
        db.execute(
            """
            INSERT INTO user_submissions (user_id, challenge_id, answer_text)
            VALUES (%s, %s, %s)
            """,
            (current_user["id"], challenge_id, chosen_opt),
        )
        return {
            "message": f"Salvato! Hai guadagnato {challenge['points']} punti! 🎉",
            "option": chosen_opt,
            "points_awarded": challenge["points"],
            "status": "created"
        }


# ── QUIZ (type=quiz) ─────────────────────────────────────────────────────────

class QuizRequest(BaseModel):
    answer: str


@router.post("/quiz/{challenge_id}")
def submit_quiz(
    challenge_id: int,
    body: QuizRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Risponde a una domanda del quiz. Una sola risposta per utente.
    """
    challenge = _get_active_challenge(challenge_id, "quiz")

    # Controlla se ha già risposto
    already = db.query_one(
        "SELECT id FROM user_submissions WHERE user_id = %s AND challenge_id = %s",
        (current_user["id"], challenge_id),
    )
    if already:
        raise HTTPException(status_code=409, detail="Hai già risposto a questa domanda.")

    answer_normalized = body.answer.strip().lower()
    correct_normalized = (challenge.get("correct_answer") or "").strip().lower()
    is_correct = answer_normalized == correct_normalized

    db.execute(
        """
        INSERT INTO user_submissions (user_id, challenge_id, answer_text)
        VALUES (%s, %s, %s)
        """,
        (current_user["id"], challenge_id, body.answer.strip()),
    )

    return {
        "is_correct": is_correct,
        "correct": is_correct,
        "correct_answer": challenge.get("correct_answer"),
        "points_awarded": challenge["points"] if is_correct else 0,
        "message": "Risposta corretta! 🎉" if is_correct else f"Risposta sbagliata! Era la {challenge.get('correct_answer')}",
    }


# ── GALLERY PUBBLICA ─────────────────────────────────────────────────────────

@router.get("/gallery")
def get_gallery():
    """
    Ritorna tutte le foto caricate con nome dell'invitato.
    """
    photos = db.query(
        """
        SELECT
            s.id,
            s.user_id,
            s.image_url,
            s.created_at,
            u.first_name,
            u.last_name,
            c.type  AS challenge_type,
            c.title AS challenge_title
        FROM user_submissions s
        JOIN users u ON u.id = s.user_id
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.type IN ('photo', 'hunt')
          AND s.image_url IS NOT NULL
        ORDER BY s.created_at DESC
        """
    )
    return [
        {
            "id": str(p["id"]),
            "user_id": str(p["user_id"]),
            "image_url": p["image_url"],
            "photo_url": p["image_url"],
            "created_at": p["created_at"].isoformat(),
            "first_name": p["first_name"],
            "last_name": p["last_name"],
            "author": f"{p['first_name'].capitalize()} {p['last_name'].capitalize()}",
            "challenge_type": p["challenge_type"],
            "challenge_title": p["challenge_title"],
        }
        for p in photos
    ]



# ── SUBMISSION DELL'UTENTE CORRENTE ──────────────────────────────────────────

@router.get("/mine")
def my_submissions(current_user: dict = Depends(get_current_user)):
    """Tutte le submission dell'utente corrente con dettaglio challenge."""
    rows = db.query(
        """
        SELECT
            s.id,
            s.challenge_id,
            s.image_url,
            s.answer_text,
            s.created_at,
            c.title,
            c.type,
            c.points,
            c.correct_answer
        FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE s.user_id = %s
        ORDER BY s.created_at DESC
        """,
        (current_user["id"],),
    )
    result = []
    for r in rows:
        is_quiz = r["type"] == "quiz"
        user_ans = (r["answer_text"] or "").strip().lower()
        corr_ans = (r["correct_answer"] or "").strip().lower()
        is_correct = (user_ans == corr_ans) if is_quiz else True
        points_awarded = r["points"] if is_correct else 0
        result.append({
            "id": str(r["id"]),
            "challenge_id": r["challenge_id"],
            "challenge_title": r["title"],
            "challenge_type": r["type"],
            "points": r["points"],
            "points_awarded": points_awarded,
            "is_correct": is_correct if is_quiz else None,
            "correct_answer": r["correct_answer"] if is_quiz else None,
            "image_url": r["image_url"],
            "answer_text": r["answer_text"],
            "created_at": r["created_at"].isoformat(),
        })
    return result
