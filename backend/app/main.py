"""
Ponto de entrada da aplicação FastAPI.

Integrações ativas:
- Sentry: captura de exceptions e performance tracing (ativa quando SENTRY_DSN for definido)
- RequestLoggingMiddleware: logging estruturado com X-Request-ID em cada requisição
- Rate Limiting via slowapi: proteção por IP em endpoints críticos
- Health check enriquecido: verifica banco de dados e retorna metadados da app
"""
import logging
import time
from contextlib import asynccontextmanager
from typing import List

import sentry_sdk
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from app.api import auth, equipments, quotes, users
from app.core.config import get_settings
from app.db.session import get_db
from app.middleware.logging import RequestLoggingMiddleware

# ─────────────────────────────────────────────────────────────────────────────
# Configurações
# ─────────────────────────────────────────────────────────────────────────────
settings = get_settings()

# ── Logging estruturado ───────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

# Silencia logs verbosos de libs externas em produção
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

logger = logging.getLogger("app.main")

# ── Sentry ────────────────────────────────────────────────────────────────────
# Ativa apenas quando SENTRY_DSN estiver configurado (não polui logs em dev)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        release=f"{settings.APP_NAME}@{settings.APP_VERSION}",
        # Captura 100% das transações em dev, 10% em prod para economia de cota
        traces_sample_rate=1.0 if settings.APP_ENV == "development" else 0.1,
        # Captura 20% das sessões de profiling
        profiles_sample_rate=0.2,
        send_default_pii=False,  # LGPD: não envia dados pessoais automaticamente
    )
    logger.info("Sentry inicializado. Environment: %s", settings.APP_ENV)
else:
    logger.info("Sentry desativado (SENTRY_DSN não configurado).")

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

# ─────────────────────────────────────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 %s v%s iniciando... (env=%s)", settings.APP_NAME, settings.APP_VERSION, settings.APP_ENV)
    yield
    logger.info("🛑 %s finalizando.", settings.APP_NAME)


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── Rate limiting error handler ───────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middlewares (ordem importa: o primeiro registrado é o mais externo) ────────
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],  # Expõe o request_id para o frontend
)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Manager
# ─────────────────────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.debug("WebSocket conectado. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.debug("WebSocket desconectado. Total: %d", len(self.active_connections))

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        # Limpa conexões mortas
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
app.state.ws_manager = manager


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ─────────────────────────────────────────────────────────────────────────────
# Rotas
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(equipments.router, prefix="/api/equipments", tags=["Equipments"])
app.include_router(quotes.router,     prefix="/api/quotes",     tags=["Quotes"])
app.include_router(users.router,      prefix="/api/users",      tags=["Users"])


# ─────────────────────────────────────────────────────────────────────────────
# Health Check enriquecido
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Meta"])
async def health_check(request: Request):
    """
    Verifica saúde da aplicação.
    Inclui: status do banco de dados, versão da app, ambiente e latência do DB.
    Usado por Docker healthcheck, load balancers e dashboards de monitoramento.
    """
    db_status = "ok"
    db_latency_ms = None

    try:
        # Pega a session do DB diretamente para o health check
        async for db in get_db():
            t0 = time.perf_counter()
            await db.execute(text("SELECT 1"))
            db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            break
    except Exception as exc:
        db_status = f"error: {str(exc)}"
        logger.error("Health check: DB indisponível — %s", exc)

    ws_connections = len(manager.active_connections)
    overall = "ok" if db_status == "ok" else "degraded"

    return JSONResponse(
        status_code=200 if overall == "ok" else 503,
        content={
            "status": overall,
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "database": {
                "status": db_status,
                "latency_ms": db_latency_ms,
            },
            "websocket": {
                "active_connections": ws_connections,
            },
            "sentry": "active" if settings.SENTRY_DSN else "disabled",
        },
    )
