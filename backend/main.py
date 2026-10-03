"""
Punto di ingresso dell'applicazione FastAPI.
- Inizializza il pool DB all'avvio
- Registra tutti i router API
- Serve i file statici del frontend Svelte (cartella ../frontend/dist)
- Qualsiasi route non trovata → index.html (SPA client-side routing)
"""
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from limiter import limiter
import db
from routers import auth, challenges, submissions, leaderboard, events, admin, dashboard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── LIFECYCLE ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.init_pool()
    logger.info("Applicazione avviata.")
    yield
    # Shutdown
    if db._pool:
        db._pool.closeall()
    logger.info("Pool chiuso.")


app = FastAPI(title="Fanta Matrimonio API", version="1.0.0", lifespan=lifespan)

# Collega slowapi all'app FastAPI
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── SECURITY HEADERS & SIZE LIMIT MIDDLEWARE ──────────────────────────────────
# Massimo 55MB per supportare gli upload fotografici senza consentire payload infiniti (DoS via upload)
MAX_CONTENT_LENGTH = 55 * 1024 * 1024

class SecurityAndLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Protezione anti-DoS sul payload size
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_CONTENT_LENGTH:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Payload troppo grande. Dimensione massima consentita: 50MB."}
                    )
            except ValueError:
                pass

        # 2. Esecuzione richiesta
        response = await call_next(request)

        # 3. Security headers (OWASP best practices: XSS, Clickjacking, MIME-Sniffing)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=*, microphone=(), geolocation=()"

        return response

app.add_middleware(SecurityAndLimitMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Permissivo in sviluppo; in produzione Railway serve tutto dalla stessa origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── ROUTER API ────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(challenges.router)
app.include_router(submissions.router)
app.include_router(leaderboard.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(dashboard.router)


# ── HEALTH CHECK ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── STATIC FILES (frontend Svelte build) ─────────────────────────────────────

STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if STATIC_DIR.exists():
    # Monta gli asset (JS, CSS, immagini)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str, request: Request):
        """
        Fallback SPA: qualsiasi path non API serve index.html.
        Il routing client-side di Svelte gestisce il resto.
        """
        index = STATIC_DIR / "index.html"
        return FileResponse(index)
else:
    logger.warning(
        f"Frontend build non trovato in {STATIC_DIR}. "
        "Esegui 'npm run build' nella cartella frontend."
    )

    @app.get("/")
    def root():
        return {"message": "API Fanta Matrimonio. Frontend non ancora buildato."}


# ── ENTRYPOINT (sviluppo locale) ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    from config import PORT

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
