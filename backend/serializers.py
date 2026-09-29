"""Funzioni di serializzazione condivise per le risposte API."""


def event_out(event: dict) -> dict:
    return {
        "id": str(event["id"]),
        "spouse1_name": event["spouse1_name"],
        "spouse2_name": event["spouse2_name"],
        "enable_timer": event["enable_timer"],
        "start_time": event["start_time"].isoformat() if event["start_time"] else None,
        "end_time": event["end_time"].isoformat() if event["end_time"] else None,
    }


def user_out(user: dict) -> dict:
    return {
        "id": str(user["id"]),
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "total_points": user["total_points"],
        "role": user["role"],
    }
