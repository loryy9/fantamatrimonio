"""
Upload di foto su Supabase Storage.
"""
import uuid
import mimetypes
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET

_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


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

    _client.storage.from_(STORAGE_BUCKET).upload(
        path=filename,
        file=file_bytes,
        file_options={"content-type": content_type},
    )

    public_url = _client.storage.from_(STORAGE_BUCKET).get_public_url(filename)
    return public_url


def delete_photo(photo_url: str) -> None:
    """Elimina la foto dal bucket Supabase Storage dato il suo URL pubblico."""
    if not photo_url:
        return
    try:
        filename = photo_url.split("/")[-1].split("?")[0]
        if filename:
            _client.storage.from_(STORAGE_BUCKET).remove([filename])
    except Exception:
        pass
