"""
Upload di foto su Supabase Storage.
"""
import logging
import uuid
import mimetypes
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_supabase_client() -> Client:
    """Ritorna l'istanza singleton del client Supabase con lazy initialization."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError(
                "SUPABASE_URL e SUPABASE_SERVICE_KEY non sono configurati nel file .env! "
                "Recuperali da Supabase Dashboard -> Project Settings -> API."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def upload_photo(file_bytes: bytes, content_type: str) -> str:
    """
    Carica i byte di un'immagine nel bucket Supabase Storage.
    Ritorna l'URL pubblico del file caricato.
    """
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    # .jpeg → normalizza a .jpg
    if ext == ".jpeg":
        ext = ".jpg"

    filename = f"{uuid.uuid4()}{ext}"
    client = get_supabase_client()

    try:
        client.storage.from_(STORAGE_BUCKET).upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
    except Exception as e:
        logger.error(
            f"Errore durante l'upload su Supabase Storage (bucket '{STORAGE_BUCKET}'). "
            f"Verifica che il bucket esista e sia impostato su 'Public' su Supabase. Errore: {e}"
        )
        raise e

    public_url = client.storage.from_(STORAGE_BUCKET).get_public_url(filename)
    return public_url


def delete_photo(photo_url: str) -> None:
    """Elimina la foto dal bucket Supabase Storage dato il suo URL pubblico."""
    if not photo_url:
        return
    try:
        filename = photo_url.split("/")[-1].split("?")[0]
        if filename:
            client = get_supabase_client()
            client.storage.from_(STORAGE_BUCKET).remove([filename])
    except Exception as e:
        logger.warning(f"Impossibile eliminare foto da Supabase Storage ({photo_url}): {e}")
