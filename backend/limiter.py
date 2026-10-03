"""
Configurazione e istanza centralizzata di SlowAPI per il Rate Limiting.
Rileva correttamente gli IP reali anche dietro proxy/load balancer (es. Railway, Cloudflare, Nginx).
"""
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = logging.getLogger(__name__)

def get_real_client_ip(request: Request) -> str:
    """
    Estrae l'indirizzo IP effettivo del client dando precedenza
    agli header dei reverse proxy (Cloudflare, Railway, Nginx).
    """
    # 1. Cloudflare header
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    # 2. X-Forwarded-For (può essere una lista separata da virgole: client, proxy1, proxy2)
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        # Prende il primo IP (client originario)
        parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
        if parts:
            return parts[0]

    # 3. X-Real-IP
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.strip()

    # 4. Fallback all'indirizzo remoto standard di Starlette
    return get_remote_address(request) or "127.0.0.1"


# Istanza Limiter globale con default di sicurezza su tutte le route (120 chiamate / minuto)
limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["120/minute"],
    headers_enabled=True,
    storage_uri="memory://",
)
