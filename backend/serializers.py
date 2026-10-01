"""Funzioni di serializzazione condivise per le risposte API."""


def event_out(event: dict) -> dict:
    return {
        "id": str(event["id"]),
        "spouse1_name": event["spouse1_name"],
        "spouse2_name": event["spouse2_name"],
        "enable_timer": event["enable_timer"],
        "start_time": event["start_time"].isoformat() if event["start_time"] else None,
        "end_time": event["end_time"].isoformat() if event["end_time"] else None,
        "invite_code": event.get("invite_code"),
    }


def user_out(user: dict) -> dict:
    out = {
        "id": str(user["id"]),
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "total_points": user["total_points"],
        "role": user["role"],
    }
    if user.get("account_id"):
        out["account_id"] = str(user["account_id"])
    if user.get("email"):
        out["email"] = user["email"]
    return out


def account_out(account: dict) -> dict:
    return {
        "id": str(account["id"]),
        "email": account.get("email"),
        "display_name": account["display_name"],
        "is_verified": account.get("is_verified", False),
        "registered_at": account["registered_at"].isoformat() if account.get("registered_at") else None,
    }
