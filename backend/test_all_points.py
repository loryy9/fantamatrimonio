import io
import sys
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient

# Imposta codifica utf-8 per stdout su Windows
sys.stdout.reconfigure(encoding='utf-8')

import db
from main import app

def run_tests():
    db.init_pool()
    client = TestClient(app)

    print("=" * 60)
    print(">> AVVIO TEST COMPLETO ASSEGNAZIONE PUNTI FANTA MATRIMONIO")
    print("=" * 60)

    # 1. Verifica consistenza sfide nel DB
    print("\n[TEST 1] Verifica configurazione punti sfide nel DB...")
    challenges = db.query("SELECT id, title, points, type, correct_answer FROM challenges WHERE active = TRUE")
    photo_challenge = next((c for c in challenges if c["type"] == "photo"), None)
    assert photo_challenge is not None, "Sfida photo mancante!"
    assert photo_challenge["points"] == 10, f"I punti della sfida photo sono {photo_challenge['points']}, attesi 10!"
    print(f"  [OK] Sfida Photo: '{photo_challenge['title']}' -> {photo_challenge['points']} PT (CORRETTO)")

    hunt_challenges = [c for c in challenges if c["type"] == "hunt"]
    quiz_challenges = [c for c in challenges if c["type"] == "quiz"]
    vote_challenges = [c for c in challenges if c["type"] == "vote"]
    print(f"  [OK] Sfide Hunt ({len(hunt_challenges)}), Quiz ({len(quiz_challenges)}), Vote ({len(vote_challenges)}) caricate.")

    # 2. Creazione utente di test isolato
    test_unique = str(uuid.uuid4())[:8]
    test_first = f"test_{test_unique}"
    test_last = "guest"
    test_secret = "secret123"

    print(f"\n[TEST 2] Registrazione e Login per utente di test: {test_first} {test_last}...")
    login_res = client.post("/api/auth/login", json={
        "first_name": test_first,
        "last_name": test_last,
        "secret_word": test_secret
    })
    assert login_res.status_code == 200, f"Login fallito: {login_res.text}"
    auth_data = login_res.json()
    token = auth_data["token"]
    user_id = auth_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    
    assert auth_data["user"]["total_points"] == 0, "I punti iniziali dell'utente dovrebbero essere 0!"
    print(f"  [OK] Utente creato con ID {user_id} e Punti Iniziali = 0")

    # Mock per l'upload storage (senza inquinare il bucket con immagini fake)
    fake_img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

    try:
        with patch("storage.upload_photo", return_value="https://example.com/fake-photo.png"):
            # 3. Caricamento 1a foto libera (Gallery) -> +10 PT
            print("\n[TEST 3] Caricamento prima foto in Galleria...")
            upload1 = client.post(
                "/api/submissions/photo",
                files={"file": ("photo1.png", io.BytesIO(fake_img_bytes), "image/png")},
                headers=headers
            )
            assert upload1.status_code == 200, f"Upload 1 fallito: {upload1.text}"
            assert upload1.json()["points_awarded"] == 10, f"Punti risposta non corretti: {upload1.json()}"
            
            me = client.get("/api/auth/me", headers=headers).json()
            assert me["user"]["total_points"] == 10, f"Punti utente attesi 10, trovati {me['user']['total_points']}"
            print(f"  [OK] 1a Foto caricata con successo! Punti Dashboard/Auth/Me: {me['user']['total_points']} PT (+10)")

            # 4. Caricamento 2a foto libera (Gallery) -> +10 PT (Totale = 20)
            print("\n[TEST 4] Caricamento seconda foto in Galleria...")
            upload2 = client.post(
                "/api/submissions/photo",
                files={"file": ("photo2.png", io.BytesIO(fake_img_bytes), "image/png")},
                headers=headers
            )
            assert upload2.status_code == 200, f"Upload 2 fallito: {upload2.text}"
            me = client.get("/api/auth/me", headers=headers).json()
            assert me["user"]["total_points"] == 20, f"Punti utente attesi 20, trovati {me['user']['total_points']}"
            print(f"  [OK] 2a Foto caricata con successo! Punti Dashboard/Auth/Me: {me['user']['total_points']} PT (+10)")

            # 5. Missione Caccia Fotografica -> +5 PT (Totale = 25)
            if hunt_challenges:
                hunt = hunt_challenges[0]
                print(f"\n[TEST 5] Invio foto missione caccia '{hunt['title']}' (+{hunt['points']} PT)...")
                hunt_upload = client.post(
                    f"/api/submissions/hunt/{hunt['id']}",
                    files={"file": ("hunt.png", io.BytesIO(fake_img_bytes), "image/png")},
                    headers=headers
                )
                assert hunt_upload.status_code == 200, f"Hunt upload fallito: {hunt_upload.text}"
                me = client.get("/api/auth/me", headers=headers).json()
                expected = 20 + hunt["points"]
                assert me["user"]["total_points"] == expected, f"Punti attesi {expected}, trovati {me['user']['total_points']}"
                print(f"  [OK] Caccia completata! Punti Dashboard/Auth/Me: {me['user']['total_points']} PT (+{hunt['points']})")

                # Test prevenzione duplicati missione caccia
                hunt_dup = client.post(
                    f"/api/submissions/hunt/{hunt['id']}",
                    files={"file": ("hunt.png", io.BytesIO(fake_img_bytes), "image/png")},
                    headers=headers
                )
                assert hunt_dup.status_code == 409, "Dovrebbe bloccare duplicati per la stessa missione di caccia"
                print("  [OK] Prevenzione duplicati caccia verificata (409 Conflict).")

            # 6. Risposta Quiz: Sbagliata (0 PT) e Corretta (+points PT)
            if len(quiz_challenges) >= 2:
                q_wrong = quiz_challenges[0]
                q_correct = quiz_challenges[1]
                
                # Sbagliata
                pts_before = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                wrong_res = client.post(
                    f"/api/submissions/quiz/{q_wrong['id']}",
                    json={"answer": "RISPOSTA_SICURAMENTE_ERRATA_XYZ"},
                    headers=headers
                )
                assert wrong_res.status_code == 200
                assert wrong_res.json()["is_correct"] is False
                assert wrong_res.json()["points_awarded"] == 0
                pts_after_wrong = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                assert pts_after_wrong == pts_before, "La risposta errata non deve assegnare punti!"
                print(f"\n[TEST 6] Quiz con risposta errata: 0 PT assegnati, Totale invariato a {pts_after_wrong} PT (CORRETTO)")

                # Corretta
                correct_ans = q_correct["correct_answer"]
                correct_res = client.post(
                    f"/api/submissions/quiz/{q_correct['id']}",
                    json={"answer": correct_ans},
                    headers=headers
                )
                assert correct_res.status_code == 200
                assert correct_res.json()["is_correct"] is True
                assert correct_res.json()["points_awarded"] == q_correct["points"]
                pts_after_correct = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                assert pts_after_correct == pts_before + q_correct["points"]
                print(f"  [OK] Quiz con risposta corretta '{correct_ans}': +{q_correct['points']} PT assegnati! Totale: {pts_after_correct} PT (CORRETTO)")

            # 7. Votazione sondaggio e aggiornamento voto
            if vote_challenges:
                vote = vote_challenges[0]
                pts_before = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                vote_res1 = client.post(
                    f"/api/submissions/vote/{vote['id']}",
                    json={"option_id": "Opzione 1"},
                    headers=headers
                )
                assert vote_res1.status_code == 200
                pts_after_vote = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                assert pts_after_vote == pts_before + vote["points"]
                print(f"\n[TEST 7] Voto registrato: +{vote['points']} PT! Totale: {pts_after_vote} PT")

                # Modifica voto (non deve assegnare punti doppi)
                vote_res2 = client.post(
                    f"/api/submissions/vote/{vote['id']}",
                    json={"option_id": "Opzione 2"},
                    headers=headers
                )
                assert vote_res2.status_code == 200
                assert vote_res2.json()["points_awarded"] == 0
                pts_after_update = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
                assert pts_after_update == pts_after_vote, "L'aggiornamento del voto non deve duplicare i punti!"
                print(f"  [OK] Modifica voto: 0 PT extra, Totale invariato a {pts_after_update} PT (CORRETTO)")

            # 8. Verifica Classifica e Dettaglio Utente
            print("\n[TEST 8] Verifica sincronizzazione Leaderboard...")
            lb = client.get("/api/leaderboard", headers=headers).json()
            user_entry = next((u for u in lb if u["id"] == user_id), None)
            assert user_entry is not None, "Utente non presente in classifica!"
            current_total = client.get("/api/auth/me", headers=headers).json()["user"]["total_points"]
            assert user_entry["total_points"] == current_total, f"Punti leaderboard ({user_entry['total_points']}) != Punti auth/me ({current_total})"
            print(f"  [OK] Leaderboard allineata al 100%: Rank #{user_entry['rank']} con {user_entry['total_points']} PT")

    finally:
        # Pulizia utente di test e relative submissions dal DB
        print("\n[CLEANUP] Rimozione dati di test dal DB...")
        db.execute("DELETE FROM users WHERE id = %s", (user_id,))
        print("  [OK] Cleanup completato con successo.")

    print("\n" + "=" * 60)
    print(">> TUTTI I TEST SONO PASSATI CON SUCCESSO!")
    print("Tutti i punti (foto=10, caccia=5, quiz, voti) sono perfettamente sincronizzati.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
