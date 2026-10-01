"""
Script per elaborare i reminder di registrazione post-matrimonio in background o cron job.
Esecuzione:
  python process_reminders.py
"""
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def main():
    import db
    from email_service import process_due_reminders

    db.init_pool()
    try:
        logger.info("Verifica reminder di registrazione in scadenza...")
        result = process_due_reminders(limit=100)
        logger.info(
            f"Elaborazione completata: trovati={result['processed']}, "
            f"inviati={result['sent']}, falliti={result['failed']}"
        )
    finally:
        if db._pool:
            db._pool.closeall()

if __name__ == "__main__":
    main()
