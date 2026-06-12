"""
Middleware de logging estruturado.

Cada requisição recebe um X-Request-ID único (UUID v4) que é propagado
no header de resposta e em todos os logs daquela requisição.
O log inclui: método, path, status, duração e o request_id para correlação.
"""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("api.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware que loga toda requisição HTTP com:
    - request_id (UUID) para rastreamento
    - método, path, status code, duração em ms
    - IP do cliente (respeitando X-Forwarded-For do nginx)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Gera ou propaga o request_id
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Armazena no estado da requisição para uso nos endpoints
        request.state.request_id = request_id

        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(
                "Unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "error": str(exc),
                },
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # IP real respeitando proxy reverso
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )

        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            log_level,
            "%s %s %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
            },
        )

        # Propaga o request_id na resposta para facilitar debugging no frontend
        response.headers["X-Request-ID"] = request_id
        return response
