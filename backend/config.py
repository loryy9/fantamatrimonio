import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY: str = os.environ["SUPABASE_SERVICE_KEY"]
STORAGE_BUCKET: str = os.environ.get("STORAGE_BUCKET", "wedding-photos")
PORT: int = int(os.environ.get("PORT", 8000))
