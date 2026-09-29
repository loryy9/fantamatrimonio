"""
Rotte per le challenge (minigiochi).
GET    /api/challenges          -> lista challenge attive dell'evento corrente con stato utente
GET    /api/challenges/{id}     -> dettaglio singola challenge
POST   /api/challenges          -> crea una nuova challenge (solo sposi)
PATCH  /api/challenges/{id}     -> modifica una challenge (solo sposi)
DELETE /api/challenges/{id}     -> elimina una challenge (solo sposi)
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import db
from dependencies import get_current_user, get_current_couple
from routers.submissions import invalidate_photo_challenge_cache

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.get("")
def list_challenges(current_user: dict = Depends(get_current_user)):
    """
    Ritorna tutte le challenge attive dell'evento corrente.
    Per ogni challenge include se l'utente ha già inviato una submission.
    """
    challenges = db.query(
        "SELECT id, title, description, points, type, vote_options, active, correct_answer "
        "FROM challenges WHERE active = TRUE AND event_id = %s ORDER BY type, id",
        (current_user["event_id"],),
    )

    done = db.query(
        "SELECT challenge_id, answer_text FROM user_submissions WHERE user_id = %s",
        (current_user["id"],),
    )
    done_map = {row["challenge_id"]: row for row in done}

    result = []
    for c in challenges:
        entry = dict(c)
        entry["id"] = int(c["id"])
        entry["challenge_type"] = c["type"]
        entry["active"] = bool(c.get("active", True))
        raw_options = c.get("vote_options") or []
        if raw_options and isinstance(raw_options[0], str):
            entry["config"] = {"options": [{"id": opt, "text": opt} for opt in raw_options]}
        else:
            entry["config"] = {"options": raw_options}
        submission = done_map.get(c["id"])
        entry["completed"] = submission is not None

        if submission:
            entry["my_answer"] = submission["answer_text"]
            if c["type"] == "quiz":
                user_ans = (submission["answer_text"] or "").strip().lower()
                corr_ans = (c.get("correct_answer") or "").strip().lower()
                is_correct = user_ans == corr_ans
                entry["is_correct"] = is_correct
                entry["correct_answer"] = c.get("correct_answer")
                entry["points_awarded"] = c["points"] if is_correct else 0
            elif c["type"] == "vote":
                entry["my_vote"] = submission["answer_text"]
        else:
            if c["type"] == "quiz":
                entry.pop("correct_answer", None)

        result.append(entry)

    return result


@router.get("/{challenge_id}")
def get_challenge(challenge_id: int, current_user: dict = Depends(get_current_user)):
    """Dettaglio di una singola challenge, scoped all'evento corrente."""
    challenge = db.query_one(
        "SELECT id, title, description, points, type, vote_options FROM challenges "
        "WHERE id = %s AND active = TRUE AND event_id = %s",
        (challenge_id, current_user["event_id"]),
    )
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge non trovata.")
    return challenge


class ChallengeRequest(BaseModel):
    title: str
    description: str
    points: int
    type: str
    active: bool = True
    correct_answer: str | None = None
    vote_options: list[str] | None = None


@router.post("")
def create_challenge(body: ChallengeRequest, current_user: dict = Depends(get_current_couple)):
    """Crea una nuova challenge nell'evento degli sposi correnti."""
    if body.type not in ("photo", "hunt", "vote", "quiz"):
        raise HTTPException(status_code=422, detail="Tipo di sfida non valido.")
    if body.points < 0:
        raise HTTPException(status_code=422, detail="I punti non possono essere negativi.")

    row = db.execute(
        """
        INSERT INTO challenges (event_id, title, description, points, type, active, correct_answer, vote_options)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            current_user["event_id"], body.title, body.description, body.points, body.type,
            body.active, body.correct_answer,
            json.dumps(body.vote_options) if body.vote_options is not None else None,
        ),
    )
    invalidate_photo_challenge_cache(current_user["event_id"])
    return row


class ChallengeUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    points: int | None = None
    active: bool | None = None
    correct_answer: str | None = None
    vote_options: list[str] | None = None


@router.patch("/{challenge_id}")
def update_challenge(challenge_id: int, body: ChallengeUpdateRequest, current_user: dict = Depends(get_current_couple)):
    """Modifica una challenge esistente. 404 se non appartiene all'evento corrente."""
    existing = db.query_one(
        "SELECT * FROM challenges WHERE id = %s AND event_id = %s",
        (challenge_id, current_user["event_id"]),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge non trovata.")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return existing

    for required_field in ("title", "description"):
        if required_field in updates and updates[required_field] is None:
            raise HTTPException(status_code=422, detail=f"Il campo '{required_field}' non può essere nullo.")

    if "points" in updates:
        if updates["points"] is None or updates["points"] < 0:
            raise HTTPException(status_code=422, detail="I punti non possono essere negativi o nulli.")
        if updates["points"] != existing["points"]:
            has_submissions = db.query_one(
                "SELECT id FROM user_submissions WHERE challenge_id = %s LIMIT 1",
                (challenge_id,),
            )
            if has_submissions:
                raise HTTPException(
                    status_code=422,
                    detail="Non puoi modificare i punti di una sfida a cui qualcuno ha già risposto.",
                )

    if "vote_options" in updates and updates["vote_options"] is not None:
        updates["vote_options"] = json.dumps(updates["vote_options"])

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [challenge_id]
    updated = db.execute(f"UPDATE challenges SET {set_clause} WHERE id = %s RETURNING *", params)
    invalidate_photo_challenge_cache(current_user["event_id"])
    return updated


@router.delete("/{challenge_id}")
def delete_challenge(challenge_id: int, current_user: dict = Depends(get_current_couple)):
    """
    Elimina una challenge. 404 se non appartiene all'evento corrente.
    Elimina prima le submission (mentre la riga challenges esiste ancora, cosi'
    il trigger update_user_points le sottrae correttamente), poi la challenge.
    """
    existing = db.query_one(
        "SELECT id FROM challenges WHERE id = %s AND event_id = %s",
        (challenge_id, current_user["event_id"]),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge non trovata.")

    with db.transaction() as cur:
        cur.execute("DELETE FROM user_submissions WHERE challenge_id = %s", (challenge_id,))
        cur.execute("DELETE FROM challenges WHERE id = %s", (challenge_id,))

    invalidate_photo_challenge_cache(current_user["event_id"])
    return {"success": True, "deleted_id": challenge_id}
