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
    if not DATABASE_URL:
        raise ValueError(
            "DATABASE_URL non configurato nel file .env! "
            "Inserisci la stringa di connessione PostgreSQL da Supabase (Project Settings -> Database -> Connection string)."
        )

    dsn = DATABASE_URL
    kwargs = {}
    if "localhost" not in dsn and "127.0.0.1" not in dsn:
        if "sslmode=" not in dsn:
            kwargs["sslmode"] = "require"
        # Keepalive per evitare disconnessioni idle da Supabase/Supavisor
        kwargs["keepalives"] = 1
        kwargs["keepalives_idle"] = 30
        kwargs["keepalives_interval"] = 10
        kwargs["keepalives_count"] = 5

    _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, dsn=dsn, **kwargs)
    logger.info("Pool PostgreSQL thread-safe inizializzato con Supabase.")


@contextmanager
def _get_conn():
    if _pool is None:
        raise RuntimeError("Il pool database non è stato inizializzato. Chiama prima db.init_pool().")

    conn = _pool.getconn()
    # Verifica se la connessione dal pool è ancora valida
    if conn.closed:
        try:
            _pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = _pool.getconn()

    try:
        yield conn
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        # Se la connessione è compromessa o si è verificato un errore di rete/SSL, scartala dal pool
        if conn.closed or isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
            try:
                _pool.putconn(conn, close=True)
                conn = None
            except Exception:
                pass
        raise
    finally:
        if conn is not None:
            _pool.putconn(conn)


@contextmanager
def transaction():
    """Cursore RealDict per piu' statement nella stessa transazione atomica."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur


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
