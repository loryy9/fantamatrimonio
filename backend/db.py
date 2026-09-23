"""
Connessione al database PostgreSQL via psycopg2.
Un pool di connessioni semplice (max 10), thread-safe.
"""
import logging
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from config import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def init_pool() -> None:
    global _pool
    _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, dsn=DATABASE_URL)
    logger.info("Pool PostgreSQL thread-safe inizializzato.")


@contextmanager
def _get_conn():
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def query(sql: str, params=None) -> list[dict]:
    """SELECT che ritorna tutte le righe come lista di dict."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, params=None) -> dict | None:
    """SELECT che ritorna la prima riga o None."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None


def execute(sql: str, params=None) -> dict | None:
    """INSERT/UPDATE/DELETE con RETURNING * opzionale."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone() if cur.description else None
            return dict(row) if row else None
