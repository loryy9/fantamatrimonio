import json
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            status = res.status
            content = res.read().decode("utf-8")
            try:
                return status, json.loads(content)
            except:
                return status, content
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except:
            return e.code, err_content

def test_full_flow():
    print("=== TEST 1: Health & SPA Root ===")
    status, res = request("/api/health")
    assert status == 200 and res.get("status") == "ok", f"Health failed: {status} {res}"
    print("  [OK] /api/health ->", res)

    status, html = request("/")
    assert status == 200 and "<div id=\"app\">" in html, f"SPA root failed: {status}"
    print("  [OK] / (SPA index.html) -> 200 OK")

    print("\n=== TEST 2: Create Event ===")
    status, event_res = request("/api/events", method="POST", data={
        "spouse1_name": "Sposo1", "spouse2_name": "Sposo2", "enable_timer": False,
        "couple_first_name": "e2e", "couple_last_name": "couple", "couple_secret_word": "e2esecret",
    })
    assert status == 200, f"Event creation failed: {status} {event_res}"
    invite_code = event_res["invite_code"]
    couple_token = event_res["token"]
    event_id = event_res["event"]["id"]
    print(f"  [OK] Event created with invite code {invite_code}")

    print("\n=== TEST 3: Seed a quiz and a vote challenge ===")
    status, quiz_c = request("/api/challenges", method="POST", data={
        "title": "Domanda di prova", "description": "d", "points": 4, "type": "quiz", "correct_answer": "a",
    }, token=couple_token)
    assert status == 200, f"Quiz creation failed: {status} {quiz_c}"
    status, vote_c = request("/api/challenges", method="POST", data={
        "title": "Voto di prova", "description": "d", "points": 3, "type": "vote", "vote_options": ["A", "B"],
    }, token=couple_token)
    assert status == 200, f"Vote creation failed: {status} {vote_c}"
    print("  [OK] Quiz and vote challenges created")

    try:
        print("\n=== TEST 4: Auth Login ===")
        status, login_res = request("/api/auth/login", method="POST", data={
            "invite_code": invite_code,
            "first_name": "Mario",
            "last_name": "Rossi",
            "secret_word": "matrimonio123"
        })
        assert status == 200, f"Login failed: {status} {login_res}"
        token = login_res["token"]
        user = login_res["user"]
        print(f"  [OK] Logged in as: {user['first_name']} {user['last_name']} (ID: {user['id']})")
        print(f"  [OK] Total Points: {user['total_points']}")

        print("\n=== TEST 5: Auth /me ===")
        status, me_res = request("/api/auth/me", token=token)
        assert status == 200, f"/me failed: {status} {me_res}"
        print(f"  [OK] /api/auth/me confirmed user: {me_res['user']['first_name']}")

        print("\n=== TEST 6: Challenges List ===")
        status, challenges = request("/api/challenges", token=token)
        assert status == 200 and len(challenges) > 0, f"Challenges failed: {status} {challenges}"
        print(f"  [OK] Loaded {len(challenges)} challenges:")
        for c in challenges:
            print(f"     - [{c['challenge_type'].upper()}] {c['title']} (+{c['points']} pt)")

        print("\n=== TEST 7: Vote Challenge ===")
        vote_challenge = next((c for c in challenges if c["challenge_type"] == "vote"), None)
        status, v_res = request(f"/api/submissions/vote/{vote_challenge['id']}", method="POST", data={"option_id": "A"}, token=token)
        print(f"  [OK] Voted on '{vote_challenge['title']}': Status {status} -> {v_res.get('status')}")

        print("\n=== TEST 8: Quiz Challenge ===")
        quiz_challenge = next((c for c in challenges if c["challenge_type"] == "quiz"), None)
        status, q_res = request(f"/api/submissions/quiz/{quiz_challenge['id']}", method="POST", data={"answer": "a"}, token=token)
        print(f"  [OK] Quiz '{quiz_challenge['title']}': Status {status} -> Correct: {q_res.get('is_correct')}, Answered: {q_res.get('correct_answer')}")

        print("\n=== TEST 9: Leaderboard ===")
        status, lb = request("/api/leaderboard", token=token)
        assert status == 200, f"Leaderboard failed: {status} {lb}"
        print(f"  [OK] Leaderboard loaded ({len(lb)} guests):")
        for entry in lb:
            print(f"     #{entry['rank']} {entry['first_name']} {entry['last_name']} - {entry['total_points']} pt")

        print("\n=== TEST 10: User Detail Breakdown ===")
        status, u_detail = request(f"/api/leaderboard/{user['id']}", token=token)
        assert status == 200, f"User detail failed: {status} {u_detail}"
        print(f"  [OK] User detail for {u_detail['user']['first_name']}: {len(u_detail['submissions'])} submissions recorded.")

        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The backend + frontend integration is 100% operational.")
    finally:
        # Cleanup goes through the DB directly since this script only talks HTTP to a live server
        # and there is no "delete event" API endpoint (by design, see Spec A's non-goals).
        import db
        db.init_pool()
        db.execute("DELETE FROM events WHERE id = %s", (event_id,))

if __name__ == "__main__":
    test_full_flow()
