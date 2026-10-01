"""
Rotte Dashboard — panoramica cross-evento per utenti registrati.
GET  /api/dashboard/events                     → lista eventi dell'account
GET  /api/dashboard/events/{event_id}          → dettaglio evento (galleria, quiz, partecipanti, codice)
GET  /api/dashboard/events/{event_id}/submissions → submissions con privacy
"""

from fastapi import APIRouter, HTTPException, Depends

import db
from serializers import event_out, user_out
from dependencies import get_current_account, get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/events")
def list_my_events(account: dict = Depends(get_current_account)):
    """
    Lista di tutti gli eventi a cui l'account ha partecipato (come ospite o sposo).
    """
    events = db.query(
        """
        SELECT e.*, u.role, u.total_points, u.first_name AS user_first_name,
               u.last_name AS user_last_name, u.id AS user_id,
               (SELECT COUNT(*) FROM users u2 WHERE u2.event_id = e.id AND u2.role = 'guest') AS guests_count,
               (SELECT COUNT(*) FROM user_submissions s
                JOIN challenges c ON c.id = s.challenge_id
                WHERE c.event_id = e.id AND s.image_url IS NOT NULL) AS photos_count
        FROM events e
        JOIN users u ON u.event_id = e.id AND u.account_id = %s
        ORDER BY e.created_at DESC
        """,
        (account["id"],),
    )

    return [
        {
            "event": event_out(ev),
            "role": ev["role"],
            "total_points": ev["total_points"],
            "user_id": str(ev["user_id"]),
            "user_name": f"{ev['user_first_name']} {ev['user_last_name']}",
            "guests_count": ev["guests_count"],
            "photos_count": ev["photos_count"],
        }
        for ev in events
    ]


@router.get("/events/{event_id}")
def get_event_detail(event_id: str, account: dict = Depends(get_current_account)):
    """
    Dettaglio di un evento: info evento, partecipanti, galleria, statistiche.
    """
    # Verifica che l'utente faccia parte di questo evento
    user_in_event = db.query_one(
        "SELECT * FROM users WHERE event_id = %s AND account_id = %s",
        (event_id, account["id"]),
    )
    if not user_in_event:
        raise HTTPException(status_code=403, detail="Non fai parte di questo evento.")

    event = db.query_one("SELECT * FROM events WHERE id = %s", (event_id,))
    if not event:
        raise HTTPException(status_code=404, detail="Evento non trovato.")

    is_couple = user_in_event["role"] == "couple"

    # Partecipanti
    participants = db.query(
        """
        SELECT id, first_name, last_name, role, total_points
        FROM users WHERE event_id = %s
        ORDER BY total_points DESC
        """,
        (event_id,),
    )

    # Galleria (foto visibili a tutti)
    photos = db.query(
        """
        SELECT s.id, s.image_url, s.created_at, s.answer_text AS caption,
               u.first_name, u.last_name, c.title AS challenge_title
        FROM user_submissions s
        JOIN users u ON u.id = s.user_id
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.event_id = %s AND s.image_url IS NOT NULL
        ORDER BY s.created_at DESC
        """,
        (event_id,),
    )

    # Statistiche
    stats = {
        "guests_count": len([p for p in participants if p["role"] == "guest"]),
        "photos_count": len(photos),
    }

    quiz_count = db.query_one(
        """
        SELECT COUNT(*) AS count FROM user_submissions s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE c.event_id = %s AND c.type = 'quiz'
        """,
        (event_id,),
    )
    stats["quiz_count"] = (quiz_count or {}).get("count", 0)

    return {
        "event": event_out(event),
        "is_couple": is_couple,
        "my_user_id": str(user_in_event["id"]),
        "participants": [user_out(p) for p in participants],
        "photos": [
            {
                "id": str(p["id"]),
                "image_url": p["image_url"],
                "caption": p.get("caption"),
                "created_at": p["created_at"].isoformat() if p["created_at"] else None,
                "author": f"{p['first_name']} {p['last_name']}",
                "challenge_title": p.get("challenge_title"),
            }
            for p in photos
        ],
        "stats": stats,
    }


@router.get("/events/{event_id}/submissions")
def get_event_submissions(event_id: str, account: dict = Depends(get_current_account)):
    """
    Submissions con privacy:
    - Sposi: vedono tutte le submissions di tutti
    - Ospiti: vedono solo le proprie submissions (quiz/vote), le foto di tutti
    """
    user_in_event = db.query_one(
        "SELECT * FROM users WHERE event_id = %s AND account_id = %s",
        (event_id, account["id"]),
    )
    if not user_in_event:
        raise HTTPException(status_code=403, detail="Non fai parte di questo evento.")

    is_couple = user_in_event["role"] == "couple"

    if is_couple:
        # Sposi vedono tutto
        submissions = db.query(
            """
            SELECT s.id, s.user_id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
                   u.first_name, u.last_name,
                   c.title AS challenge_title, c.type AS challenge_type, c.correct_answer
            FROM user_submissions s
            JOIN users u ON u.id = s.user_id
            JOIN challenges c ON c.id = s.challenge_id
            WHERE c.event_id = %s
            ORDER BY s.created_at DESC
            """,
            (event_id,),
        )
    else:
        # Ospiti: foto di tutti + proprie submissions per quiz/vote
        submissions = db.query(
            """
            SELECT s.id, s.user_id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
                   u.first_name, u.last_name,
                   c.title AS challenge_title, c.type AS challenge_type,
                   CASE WHEN s.user_id = %s THEN c.correct_answer ELSE NULL END AS correct_answer
            FROM user_submissions s
            JOIN users u ON u.id = s.user_id
            JOIN challenges c ON c.id = s.challenge_id
            WHERE c.event_id = %s
              AND (s.image_url IS NOT NULL OR s.user_id = %s)
            ORDER BY s.created_at DESC
            """,
            (user_in_event["id"], event_id, user_in_event["id"]),
        )

    return [
        {
            "id": str(s["id"]),
            "user_id": str(s["user_id"]),
            "challenge_id": s["challenge_id"],
            "image_url": s.get("image_url"),
            "answer_text": s.get("answer_text"),
            "created_at": s["created_at"].isoformat() if s["created_at"] else None,
            "author": f"{s['first_name']} {s['last_name']}",
            "challenge_title": s.get("challenge_title"),
            "challenge_type": s.get("challenge_type"),
            "correct_answer": s.get("correct_answer"),
        }
        for s in submissions
    ]
