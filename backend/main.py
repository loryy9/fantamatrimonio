"""
Punto di ingresso dell'applicazione FastAPI.
- Inizializza il pool DB all'avvio
- Registra tutti i router API
- Serve i file statici del frontend Svelte (cartella ../frontend/dist)
- Qualsiasi route non trovata → index.html (SPA client-side routing)
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import db
from routers import auth, challenges, submissions, leaderboard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fanta Matrimonio API", version="1.0.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
# Permissivo in sviluppo; in produzione Railway serve tutto dalla stessa origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LIFECYCLE ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    db.init_pool()
    logger.info("Applicazione avviata.")


@app.on_event("shutdown")
def shutdown():
    if db._pool:
        db._pool.closeall()
    logger.info("Pool chiuso.")


# ── ROUTER API ────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(challenges.router)
app.include_router(submissions.router)
app.include_router(leaderboard.router)


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
