"""
Script di verifica per la connessione a Supabase (Database PostgreSQL + Storage Bucket).
Esegui con:
    python test_supabase.py
"""
import sys
import logging

# Supporto UTF-8 per console Windows
if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO)

def mask_connection_string(dsn: str) -> str:
    if not dsn:
        return "(non configurato)"
    try:
        # Nasconde la password per sicurezza
        parts = dsn.split("@")
        if len(parts) == 2:
            creds, host = parts
            proto_user = creds.split(":")
            if len(proto_user) >= 2:
                masked_creds = ":".join(proto_user[:-1]) + ":******"
                return f"{masked_creds}@{host}"
        return dsn[:15] + "..."
    except Exception:
        return "(protetta)"

def test_supabase():
    print("\n" + "=" * 60)
    print("🔍 VERIFICA CONNESSIONE SUPABASE (Fanta Matrimonio)")
    print("=" * 60)

    from config import DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET

    print(f"DATABASE_URL:         {mask_connection_string(DATABASE_URL)}")
    print(f"SUPABASE_URL:         {SUPABASE_URL or '(non configurato)'}")
    print(f"SUPABASE_SERVICE_KEY: {'configurata (' + SUPABASE_SERVICE_KEY[:10] + '...)' if SUPABASE_SERVICE_KEY else '(non configurata)'}")
    print(f"STORAGE_BUCKET:       {STORAGE_BUCKET}")
    print("-" * 60)

    # 1. TEST DATABASE POSTGRESQL
    print("\n[1/2] Test Database PostgreSQL...")
    if not DATABASE_URL or "127.0.0.1" in DATABASE_URL or "localhost" in DATABASE_URL:
        print("⚠️  ATTENZIONE: DATABASE_URL punta a localhost/Docker o non è impostato.")
        print("    Per collegare Supabase, inserisci la Connection String del tuo progetto.")
    
    import db
    try:
        db.init_pool()
        res = db.query_one("SELECT version();")
        print("✅ Connessione al database riuscita!")
        print(f"   Postgres Version: {res['version'].split(',')[0] if res else 'OK'}")

        # Controllo tabelle necessarie
        expected_tables = [
            "events",
            "accounts",
            "users",
            "challenges",
            "user_submissions",
            "sessions",
            "registration_reminders",
            "email_verification_codes",
        ]
        
        tables_in_db = db.query(
            """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
            """
        )
        existing = {row["table_name"] for row in tables_in_db}
        
        missing = [t for t in expected_tables if t not in existing]
        if missing:
            print(f"⚠️  Tabelle mancanti nel database: {', '.join(missing)}")
            print("   👉 Esegui il file 'db/schema_complete.sql' nell'SQL Editor della dashboard di Supabase.")
        else:
            print(f"✅ Tutte le tabelle necessarie ({len(expected_tables)}/{len(expected_tables)}) sono presenti!")

    except Exception as e:
        print(f"❌ Errore connessione Database: {e}")
        print("\nSuggerimenti:")
        print("1. Verifica di aver copiato la Connection String corretta da Supabase:")
        print("   Dashboard -> Project Settings -> Database -> Connection string -> URI")
        print("2. Se sei su una rete Wi-Fi/fibra con solo IPv4, usa il Connection Pooler (porta 5432 o 6543):")
        print("   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres")
        print("3. Assicurati che la password non contenga caratteri speciali non codificati (es. %23 per #).")

    # 2. TEST SUPABASE STORAGE
    print("\n[2/2] Test Supabase Storage...")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_URL o SUPABASE_SERVICE_KEY mancanti nel file .env!")
    else:
        try:
            import storage
            client = storage.get_supabase_client()
            buckets = client.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            
            if STORAGE_BUCKET not in bucket_names:
                print(f"⚠️  Il bucket '{STORAGE_BUCKET}' non esiste su Supabase Storage.")
                print(f"   Bucket trovati: {bucket_names or 'nessuno'}")
                print(f"   👉 Crealo nella dashboard di Supabase -> Storage -> New Bucket -> inserisci '{STORAGE_BUCKET}' e spunta 'Public bucket'!")
            else:
                print(f"✅ Bucket '{STORAGE_BUCKET}' trovato!")
                # Test upload e delete file temporaneo
                test_bytes = b"test supabase connection"
                url = storage.upload_photo(test_bytes, "text/plain")
                print(f"✅ Test upload riuscito! File test: {url}")
                storage.delete_photo(url)
                print("✅ Test cancellazione file temporaneo riuscito!")
                print("✅ Supabase Storage è perfettamente funzionante!")

        except Exception as e:
            print(f"❌ Errore Supabase Storage: {e}")
            print("\nSuggerimenti:")
            print("1. Verifica che SUPABASE_URL inizi con https:// e sia il tuo Project URL.")
            print("2. Verifica che SUPABASE_SERVICE_KEY sia la 'service_role' secret key e NON la 'anon' public key.")
            print("3. Assicurati che il bucket sia impostato su 'Public'!")

    print("\n" + "=" * 60 + "\n")

if __name__ == "__main__":
    test_supabase()
