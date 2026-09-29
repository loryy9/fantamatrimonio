"""
Test di integrazione per la multi-tenancy (eventi/matrimoni multipli).
Eseguire con: python test_multi_tenant.py
Richiede un database configurato in backend/.env (stesso DB usato da
test_all_points.py) — ogni funzione crea e ripulisce i propri dati.
"""
import io
import re
import sys
import time
import uuid
from unittest.mock import patch

sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient

import db
from main import app
from invite_codes import generate_invite_code

_INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def _ensure_pool():
    if db._pool is None:
        db.init_pool()


def test_invite_code_format():
    codes = [generate_invite_code() for _ in range(50)]
    for code in codes:
        assert len(code) == 6, f"Codice di lunghezza errata: {code}"
        assert re.fullmatch(f"[{_INVITE_CODE_ALPHABET}]{{6}}", code), \
            f"Codice con caratteri non ammessi: {code}"
    assert len(set(codes)) > 45, "Troppe collisioni tra codici generati in sequenza"


def test_schema_has_multi_tenant_columns():
    _ensure_pool()
    cols = db.query(
        """
        SELECT table_name, column_name FROM information_schema.columns
        WHERE (table_name = 'events' AND column_name = 'invite_code')
           OR (table_name = 'users' AND column_name IN ('event_id', 'role'))
           OR (table_name = 'challenges' AND column_name = 'event_id')
        """
    )
    found = {(c["table_name"], c["column_name"]) for c in cols}
    assert ("events", "invite_code") in found, "Tabella events o colonna invite_code mancante"
    assert ("users", "event_id") in found, "Colonna users.event_id mancante"
    assert ("users", "role") in found, "Colonna users.role mancante"
    assert ("challenges", "event_id") in found, "Colonna challenges.event_id mancante"


def _create_event(client, unique, suffix="a"):
    # TestClient's requests all share the same client IP ("testclient"), so the
    # production per-IP rate limiter (5 events/hour) would otherwise trip after
    # a handful of calls across this whole test file. Clearing it here keeps the
    # production limiter's logic and thresholds untouched while letting the test
    # suite create as many events as its scenarios need.
    from routers.events import _creation_log
    _creation_log.clear()

    res = client.post("/api/events", json={
        "spouse1_name": f"S1{suffix}",
        "spouse2_name": f"S2{suffix}",
        "enable_timer": suffix != "notimer",
        "start_time": "2026-06-14T12:00:00Z" if suffix != "notimer" else None,
        "end_time": "2026-06-14T20:00:00Z" if suffix != "notimer" else None,
        "couple_first_name": f"couple_{suffix}_{unique}",
        "couple_last_name": "test",
        "couple_secret_word": "secret123",
    })
    assert res.status_code == 200, res.text
    return res.json()


def test_create_event_and_manage():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]

    event = _create_event(client, unique, "mgmt")
    assert event["user"]["role"] == "couple"
    assert len(event["invite_code"]) == 6
    headers = {"Authorization": f"Bearer {event['token']}"}

    try:
        me_event = client.get("/api/events/me", headers=headers)
        assert me_event.status_code == 200
        assert me_event.json()["spouse1_name"] == "S1mgmt"

        inv = client.get("/api/events/me/invite", headers=headers)
        assert inv.status_code == 200
        assert inv.json()["invite_code"] == event["invite_code"]

        patched = client.patch("/api/events/me", json={"spouse1_name": "Updated"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["spouse1_name"] == "Updated"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_patch_event_requires_couple_role():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "role")
    event_id = event["event"]["id"]

    # Insert a plain guest directly (auth.py's login endpoint is updated in Task 4)
    guest = db.execute(
        "INSERT INTO users (event_id, role, first_name, last_name, secret_word) "
        "VALUES (%s, 'guest', %s, %s, %s) RETURNING id",
        (event_id, f"guest_{unique}", "test", "secret"),
    )
    token = str(uuid.uuid4())
    db.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, guest["id"]))
    headers = {"Authorization": f"Bearer {token}"}

    try:
        res = client.patch("/api/events/me", json={"spouse1_name": "Hacked"}, headers=headers)
        assert res.status_code == 403
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event_id,))


def test_login_requires_valid_invite_code():
    _ensure_pool()
    client = TestClient(app)

    missing = client.post("/api/auth/login", json={"first_name": "a", "last_name": "b", "secret_word": "c"})
    assert missing.status_code == 422

    invalid = client.post("/api/auth/login", json={
        "invite_code": "ZZZZZZ", "first_name": "a", "last_name": "b", "secret_word": "c",
    })
    assert invalid.status_code == 404


def test_login_scopes_identity_to_event():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]

    event_a = _create_event(client, unique, "loga")
    event_b = _create_event(client, unique, "logb")

    try:
        guest_a = client.post("/api/auth/login", json={
            "invite_code": event_a["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
        })
        guest_b = client.post("/api/auth/login", json={
            "invite_code": event_b["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
        })
        assert guest_a.status_code == 200 and guest_b.status_code == 200
        assert guest_a.json()["user"]["id"] != guest_b.json()["user"]["id"]
        assert guest_a.json()["event"]["spouse1_name"] == "S1loga"
        assert guest_b.json()["event"]["spouse1_name"] == "S1logb"

        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {guest_a.json()['token']}"})
        assert me.status_code == 200
        assert me.json()["user"]["role"] == "guest"
        assert me.json()["event"]["spouse1_name"] == "S1loga"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event_a["event"]["id"],))
        db.execute("DELETE FROM events WHERE id = %s", (event_b["event"]["id"],))


def test_challenges_scoped_and_couple_only_crud():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]

    event_a = _create_event(client, unique, "cha")
    event_b = _create_event(client, unique, "chb")
    couple_a_headers = {"Authorization": f"Bearer {event_a['token']}"}
    couple_b_headers = {"Authorization": f"Bearer {event_b['token']}"}

    guest_a = client.post("/api/auth/login", json={
        "invite_code": event_a["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_a_headers = {"Authorization": f"Bearer {guest_a['token']}"}

    try:
        forbidden = client.post("/api/challenges", json={
            "title": "Hack", "description": "d", "points": 1, "type": "hunt",
        }, headers=guest_a_headers)
        assert forbidden.status_code == 403

        created = client.post("/api/challenges", json={
            "title": "Trova gli sposi", "description": "d", "points": 5, "type": "hunt",
        }, headers=couple_a_headers)
        assert created.status_code == 200, created.text
        challenge_id = created.json()["id"]

        list_a = client.get("/api/challenges", headers=guest_a_headers).json()
        assert any(c["id"] == challenge_id for c in list_a)

        list_b = client.get("/api/challenges", headers=couple_b_headers).json()
        assert all(c["id"] != challenge_id for c in list_b)

        cross_patch = client.patch(f"/api/challenges/{challenge_id}", json={"points": 99}, headers=couple_b_headers)
        assert cross_patch.status_code == 404

        patched = client.patch(f"/api/challenges/{challenge_id}", json={"points": 8}, headers=couple_a_headers)
        assert patched.status_code == 200
        assert patched.json()["points"] == 8

        deleted = client.delete(f"/api/challenges/{challenge_id}", headers=couple_a_headers)
        assert deleted.status_code == 200
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event_a["event"]["id"],))
        db.execute("DELETE FROM events WHERE id = %s", (event_b["event"]["id"],))


_FAKE_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_submissions_scoped_to_event():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]

    event_a = _create_event(client, unique, "suba")
    event_b = _create_event(client, unique, "subb")
    couple_a_headers = {"Authorization": f"Bearer {event_a['token']}"}

    hunt_a = client.post("/api/challenges", json={
        "title": "Missione A", "description": "d", "points": 5, "type": "hunt",
    }, headers=couple_a_headers).json()

    guest_b = client.post("/api/auth/login", json={
        "invite_code": event_b["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_b_headers = {"Authorization": f"Bearer {guest_b['token']}"}

    try:
        with patch("storage.upload_photo", return_value="https://example.com/fake.png"):
            cross_submit = client.post(
                f"/api/submissions/hunt/{hunt_a['id']}",
                files={"file": ("p.png", io.BytesIO(_FAKE_PNG), "image/png")},
                headers=guest_b_headers,
            )
        assert cross_submit.status_code == 404

        no_auth = client.get("/api/submissions/gallery")
        assert no_auth.status_code == 401

        gallery_b = client.get("/api/submissions/gallery", headers=guest_b_headers).json()
        assert all(p.get("challenge_title") != "Missione A" for p in gallery_b)
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event_a["event"]["id"],))
        db.execute("DELETE FROM events WHERE id = %s", (event_b["event"]["id"],))


def test_leaderboard_scoped_and_requires_auth():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]

    event_a = _create_event(client, unique, "lba")
    event_b = _create_event(client, unique, "lbb")
    b_headers = {"Authorization": f"Bearer {event_b['token']}"}

    guest_a = client.post("/api/auth/login", json={
        "invite_code": event_a["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_a_headers = {"Authorization": f"Bearer {guest_a['token']}"}

    try:
        no_auth = client.get("/api/leaderboard")
        assert no_auth.status_code == 401

        lb_a = client.get("/api/leaderboard", headers=guest_a_headers).json()
        assert any(u["id"] == guest_a["user"]["id"] for u in lb_a)

        lb_b = client.get("/api/leaderboard", headers=b_headers).json()
        assert all(u["id"] != guest_a["user"]["id"] for u in lb_b)

        cross = client.get(f"/api/leaderboard/{guest_a['user']['id']}", headers=b_headers)
        assert cross.status_code == 404

        same_event = client.get(f"/api/leaderboard/{guest_a['user']['id']}", headers=guest_a_headers)
        assert same_event.status_code == 200
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event_a["event"]["id"],))
        db.execute("DELETE FROM events WHERE id = %s", (event_b["event"]["id"],))


def test_couple_can_play_their_own_game():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "playcp")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    quiz = client.post("/api/challenges", json={
        "title": "Dove ci siamo conosciuti?", "description": "d", "points": 4, "type": "quiz",
        "correct_answer": "universita",
    }, headers=couple_headers).json()

    try:
        answer = client.post(f"/api/submissions/quiz/{quiz['id']}", json={"answer": "Universita"}, headers=couple_headers)
        assert answer.status_code == 200
        assert answer.json()["is_correct"] is True

        me = client.get("/api/auth/me", headers=couple_headers).json()
        assert me["user"]["total_points"] == 4
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_event_cascade_delete_removes_everything():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "cascade")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}
    event_id = event["event"]["id"]
    user_id = event["user"]["id"]

    challenge = client.post("/api/challenges", json={
        "title": "T", "description": "d", "points": 1, "type": "hunt",
    }, headers=couple_headers).json()

    db.execute("DELETE FROM events WHERE id = %s", (event_id,))

    assert db.query_one("SELECT id FROM users WHERE id = %s", (user_id,)) is None
    assert db.query_one("SELECT id FROM challenges WHERE id = %s", (challenge["id"],)) is None
    assert db.query_one("SELECT token FROM sessions WHERE user_id = %s", (user_id,)) is None


def test_invite_code_login_is_case_insensitive():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "casing")
    lower_code = event["invite_code"].lower()

    try:
        res = client.post("/api/auth/login", json={
            "invite_code": lower_code, "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
        })
        assert res.status_code == 200
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_patch_event_partial_update_preserves_other_fields():
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "partial")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    try:
        patched = client.patch("/api/events/me", json={"spouse1_name": "NuovoNome"}, headers=couple_headers)
        assert patched.status_code == 200
        assert patched.json()["spouse1_name"] == "NuovoNome"
        assert patched.json()["spouse2_name"] == event["event"]["spouse2_name"]
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_delete_challenge_removes_awarded_points():
    """Finding 1: cancellare una challenge con submission gia' presenti non deve
    lasciare i punti gia' assegnati "orfani" nel total_points del guest."""
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "delpts")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    hunt = client.post("/api/challenges", json={
        "title": "Missione da cancellare", "description": "d", "points": 5, "type": "hunt",
    }, headers=couple_headers).json()

    guest = client.post("/api/auth/login", json={
        "invite_code": event["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_headers = {"Authorization": f"Bearer {guest['token']}"}

    try:
        with patch("storage.upload_photo", return_value="https://example.com/fake.png"):
            submit = client.post(
                f"/api/submissions/hunt/{hunt['id']}",
                files={"file": ("p.png", io.BytesIO(_FAKE_PNG), "image/png")},
                headers=guest_headers,
            )
        assert submit.status_code == 200
        me_before = client.get("/api/auth/me", headers=guest_headers).json()
        assert me_before["user"]["total_points"] == 5

        deleted = client.delete(f"/api/challenges/{hunt['id']}", headers=couple_headers)
        assert deleted.status_code == 200

        me_after = client.get("/api/auth/me", headers=guest_headers).json()
        assert me_after["user"]["total_points"] == 0, \
            f"I punti della missione cancellata dovevano essere sottratti, trovato {me_after['user']['total_points']}"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_photo_challenge_cache_invalidated_on_challenge_changes():
    """Finding 2: la cache in-memory delle photo-challenge deve aggiornarsi
    quando la coppia crea/modifica/elimina una challenge di tipo photo."""
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "photocache")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    photo = client.post("/api/challenges", json={
        "title": "Foto libera", "description": "d", "points": 10, "type": "photo",
    }, headers=couple_headers).json()

    guest = client.post("/api/auth/login", json={
        "invite_code": event["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_headers = {"Authorization": f"Bearer {guest['token']}"}

    try:
        with patch("storage.upload_photo", return_value="https://example.com/fake.png"):
            first_upload = client.post(
                "/api/submissions/photo",
                files={"file": ("p1.png", io.BytesIO(_FAKE_PNG), "image/png")},
                headers=guest_headers,
            )
        assert first_upload.status_code == 200
        assert first_upload.json()["points_awarded"] == 10

        deleted = client.delete(f"/api/challenges/{photo['id']}", headers=couple_headers)
        assert deleted.status_code == 200

        new_photo = client.post("/api/challenges", json={
            "title": "Foto libera v2", "description": "d", "points": 20, "type": "photo",
        }, headers=couple_headers).json()

        with patch("storage.upload_photo", return_value="https://example.com/fake2.png"):
            second_upload = client.post(
                "/api/submissions/photo",
                files={"file": ("p2.png", io.BytesIO(_FAKE_PNG), "image/png")},
                headers=guest_headers,
            )
        assert second_upload.status_code == 200, \
            f"Upload dopo aver ricreato la photo-challenge non deve fallire (cache stantia): {second_upload.text}"
        assert second_upload.json()["points_awarded"] == 20, \
            "Deve usare la nuova challenge (20 pt), non quella cancellata cachata (10 pt)"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_cannot_change_points_of_challenge_with_submissions():
    """Finding 3: modificare i punti di una challenge con submission gia' presenti
    desincronizzerebbe il futuro trigger di DELETE dai punti realmente assegnati."""
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "patchpts")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    hunt = client.post("/api/challenges", json={
        "title": "Missione", "description": "d", "points": 5, "type": "hunt",
    }, headers=couple_headers).json()

    guest = client.post("/api/auth/login", json={
        "invite_code": event["invite_code"], "first_name": f"guest_{unique}", "last_name": "test", "secret_word": "pizza",
    }).json()
    guest_headers = {"Authorization": f"Bearer {guest['token']}"}

    try:
        with patch("storage.upload_photo", return_value="https://example.com/fake.png"):
            client.post(
                f"/api/submissions/hunt/{hunt['id']}",
                files={"file": ("p.png", io.BytesIO(_FAKE_PNG), "image/png")},
                headers=guest_headers,
            )

        blocked = client.patch(f"/api/challenges/{hunt['id']}", json={"points": 50}, headers=couple_headers)
        assert blocked.status_code == 422, \
            "Non deve essere possibile cambiare i punti di una challenge con submission gia' presenti"

        # Altri campi restano modificabili
        allowed = client.patch(f"/api/challenges/{hunt['id']}", json={"title": "Missione rinominata"}, headers=couple_headers)
        assert allowed.status_code == 200
        assert allowed.json()["title"] == "Missione rinominata"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


def test_patch_validation_matches_create_validation():
    """Finding 5: i PATCH devono validare l'input come i corrispondenti POST
    (422 pulito), non 500 per violazione di vincoli DB."""
    _ensure_pool()
    client = TestClient(app)
    unique = str(uuid.uuid4())[:8]
    event = _create_event(client, unique, "patchval")
    couple_headers = {"Authorization": f"Bearer {event['token']}"}

    hunt = client.post("/api/challenges", json={
        "title": "Missione", "description": "d", "points": 5, "type": "hunt",
    }, headers=couple_headers).json()

    try:
        null_title = client.patch(f"/api/challenges/{hunt['id']}", json={"title": None}, headers=couple_headers)
        assert null_title.status_code == 422, f"title=null deve dare 422, non {null_title.status_code}"

        negative_points = client.patch(f"/api/challenges/{hunt['id']}", json={"points": -5}, headers=couple_headers)
        assert negative_points.status_code == 422, f"points negativi devono dare 422, non {negative_points.status_code}"

        bad_timer = client.patch("/api/events/me", json={
            "enable_timer": True,
            "start_time": "2026-06-14T20:00:00Z",
            "end_time": "2026-06-14T12:00:00Z",
        }, headers=couple_headers)
        assert bad_timer.status_code == 422, f"end_time <= start_time deve dare 422, non {bad_timer.status_code}"

        null_spouse = client.patch("/api/events/me", json={"spouse1_name": None}, headers=couple_headers)
        assert null_spouse.status_code == 422, f"spouse1_name=null deve dare 422, non {null_spouse.status_code}"
    finally:
        db.execute("DELETE FROM events WHERE id = %s", (event["event"]["id"],))


if __name__ == "__main__":
    test_invite_code_format()
    print("[OK] test_invite_code_format")
    test_schema_has_multi_tenant_columns()
    print("[OK] test_schema_has_multi_tenant_columns")
    test_create_event_and_manage()
    print("[OK] test_create_event_and_manage")
    test_patch_event_requires_couple_role()
    print("[OK] test_patch_event_requires_couple_role")
    test_login_requires_valid_invite_code()
    print("[OK] test_login_requires_valid_invite_code")
    test_login_scopes_identity_to_event()
    print("[OK] test_login_scopes_identity_to_event")
    test_challenges_scoped_and_couple_only_crud()
    print("[OK] test_challenges_scoped_and_couple_only_crud")
    test_submissions_scoped_to_event()
    print("[OK] test_submissions_scoped_to_event")
    test_leaderboard_scoped_and_requires_auth()
    print("[OK] test_leaderboard_scoped_and_requires_auth")
    test_couple_can_play_their_own_game()
    print("[OK] test_couple_can_play_their_own_game")
    test_event_cascade_delete_removes_everything()
    print("[OK] test_event_cascade_delete_removes_everything")
    test_invite_code_login_is_case_insensitive()
    print("[OK] test_invite_code_login_is_case_insensitive")
    test_patch_event_partial_update_preserves_other_fields()
    print("[OK] test_patch_event_partial_update_preserves_other_fields")
    test_delete_challenge_removes_awarded_points()
    print("[OK] test_delete_challenge_removes_awarded_points")
    test_photo_challenge_cache_invalidated_on_challenge_changes()
    print("[OK] test_photo_challenge_cache_invalidated_on_challenge_changes")
    test_cannot_change_points_of_challenge_with_submissions()
    print("[OK] test_cannot_change_points_of_challenge_with_submissions")
    test_patch_validation_matches_create_validation()
    print("[OK] test_patch_validation_matches_create_validation")
    print("\n>> TUTTI I TEST MULTI-TENANT SONO PASSATI!")
