"""
Upload di foto su Cloudflare R2 (tramite Worker locale o cloud) o Supabase Storage.
"""
import logging
import uuid
import mimetypes
import urllib.request
import urllib.parse
from config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    STORAGE_BUCKET,
    STORAGE_PROVIDER,
    R2_WORKER_URL,
)

logger = logging.getLogger(__name__)

_supabase_client = None


def get_supabase_client():
    """Ritorna l'istanza singleton del client Supabase con lazy initialization."""
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError(
                "SUPABASE_URL e SUPABASE_SERVICE_KEY non sono configurati nel file .env! "
                "Recuperali da Supabase Dashboard -> Project Settings -> API."
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def _upload_photo_r2(file_bytes: bytes, content_type: str) -> str:
    """Carica i byte di un'immagine sul Cloudflare R2 Worker endpoint."""
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpeg":
        ext = ".jpg"

    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    filename = f"upload{ext}"

    # Costruzione multipart payload nativa
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8")
    )
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        f"{R2_WORKER_URL}/api/photos/upload",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            import json
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("url"):
                return res_data["url"]
            raise ValueError(f"Risposta Worker R2 inattesa: {res_data}")
    except Exception as e:
        logger.error(f"Errore durante l'upload su Cloudflare R2 ({R2_WORKER_URL}): {e}")
        raise e


def _delete_photo_r2(photo_url: str) -> None:
    """Elimina la foto dall'emulatore o bucket R2."""
    try:
        filename = photo_url.split("/")[-1].split("?")[0]
        if not filename:
            return
        req = urllib.request.Request(
            f"{R2_WORKER_URL}/api/photos/{filename}",
            method="DELETE",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass
    except Exception as e:
        logger.warning(f"Impossibile eliminare foto da Cloudflare R2 ({photo_url}): {e}")


def upload_photo(file_bytes: bytes, content_type: str) -> str:
    """
    Carica l'immagine su R2 o Supabase in base a STORAGE_PROVIDER.
    Ritorna l'URL pubblico/locale del file caricato.
    """
    if STORAGE_PROVIDER == "r2":
        return _upload_photo_r2(file_bytes, content_type)

    # Fallback Supabase
    ext = mimetypes.guess_extension(content_type) or ".jpg"
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
            f"Errore durante l'upload su Supabase Storage (bucket '{STORAGE_BUCKET}'): {e}"
        )
        raise e

    return client.storage.from_(STORAGE_BUCKET).get_public_url(filename)


def delete_photo(photo_url: str) -> None:
    """Elimina la foto dal provider di storage selezionato."""
    if not photo_url:
        return

    if STORAGE_PROVIDER == "r2" or R2_WORKER_URL in photo_url:
        _delete_photo_r2(photo_url)
        return

    try:
        filename = photo_url.split("/")[-1].split("?")[0]
        if filename:
            client = get_supabase_client()
            client.storage.from_(STORAGE_BUCKET).remove([filename])
    except Exception as e:
        logger.warning(f"Impossibile eliminare foto da Supabase Storage ({photo_url}): {e}")
