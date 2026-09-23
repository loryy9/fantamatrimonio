"""
Rotte per la classifica.
GET /api/leaderboard            → classifica generale
GET /api/leaderboard/{user_id}  → dettaglio punti per utente
"""
from fastapi import APIRouter, HTTPException, Depends
import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
def leaderboard():
    """
    Classifica generale di tutti gli invitati, ordinata per punti decrescenti.
    Endpoint pubblico (usato anche dal polling ogni 8-10 sec).
    """
    users = db.query(
        """
        SELECT id, first_name, last_name, total_points
        FROM users
        ORDER BY total_points DESC, first_name ASC
        """
    )
    return [
        {
            "rank": idx + 1,
            "id": str(u["id"]),
            "first_name": u["first_name"].capitalize(),
            "last_name": u["last_name"].capitalize(),
            "name": f"{u['first_name'].capitalize()} {u['last_name'].capitalize()}",
            "total_points": u["total_points"],
        }
        for idx, u in enumerate(users)
    ]


@router.get("/{user_id}")
def user_detail(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Dettaglio punti di un singolo utente: breakdown per tipo di challenge.
    Richiede autenticazione (chiunque può vedere il dettaglio di chiunque).
    """
    user = db.query_one(
        "SELECT id, first_name, last_name, total_points FROM users WHERE id = %s",
        (user_id,),
    )
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato.")

    # Breakdown per tipo
    breakdown = db.query(
        """
        SELECT
            s.id,
            c.type,
            c.title,
            c.points,
            s.answer_text,
            s.image_url,
            s.created_at
        FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE s.user_id = %s
        ORDER BY s.created_at DESC
        """,
        (user_id,),
    )

    # Calcola punti per tipo
    points_by_type: dict[str, int] = {}
    for row in breakdown:
        t = row["type"]
        points_by_type[t] = points_by_type.get(t, 0) + row["points"]

    return {
        "id": str(user["id"]),
        "user": {
            "id": str(user["id"]),
            "first_name": user["first_name"].capitalize(),
            "last_name": user["last_name"].capitalize(),
            "total_points": user["total_points"],
        },
        "first_name": user["first_name"].capitalize(),
        "last_name": user["last_name"].capitalize(),
        "name": f"{user['first_name'].capitalize()} {user['last_name'].capitalize()}",
        "total_points": user["total_points"],
        "points_by_type": points_by_type,
        "submissions": [
            {
                "id": str(r["id"]),
                "challenge_title": r["title"],
                "challenge_type": r["type"],
                "points": r["points"],
                "points_awarded": r["points"],
                "answer_text": r["answer_text"],
                "image_url": r["image_url"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in breakdown
        ],
    }

