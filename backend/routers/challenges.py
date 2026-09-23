"""
Rotte per le challenge (minigiochi).
GET /api/challenges          → lista challenge attive con stato utente
GET /api/challenges/{id}     → dettaglio singola challenge
"""
from fastapi import APIRouter, Depends
import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.get("")
def list_challenges(current_user: dict = Depends(get_current_user)):
    """
    Ritorna tutte le challenge attive.
    Per ogni challenge include se l'utente ha già inviato una submission
    (utile al frontend per mostrare stato completato/non completato).
    """
    challenges = db.query(
        "SELECT id, title, description, points, type, vote_options, active, correct_answer FROM challenges WHERE active = TRUE ORDER BY type, id"
    )

    # Submission già fatte dall'utente (per sapere cosa ha già completato)
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
        # Support either string options or dict options
        if raw_options and isinstance(raw_options[0], str):
            entry["config"] = {
                "options": [{"id": opt, "text": opt} for opt in raw_options]
            }
        else:
            entry["config"] = {
                "options": raw_options
            }
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
            # Proteggi la risposta se l'utente non ha ancora risposto al quiz
            if c["type"] == "quiz":
                entry.pop("correct_answer", None)

        result.append(entry)

    return result



@router.get("/{challenge_id}")
def get_challenge(challenge_id: int, current_user: dict = Depends(get_current_user)):
    """Dettaglio di una singola challenge."""
    challenge = db.query_one(
        "SELECT id, title, description, points, type, vote_options FROM challenges WHERE id = %s AND active = TRUE",
        (challenge_id,),
    )
    if not challenge:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Challenge non trovata.")
    return challenge
