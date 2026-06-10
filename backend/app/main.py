from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from app.api import auth, equipments, quotes, users
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# WebSocket Manager
# ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()
app.state.ws_manager = manager

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just keep connection alive, clients don't send anything
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Inclui as rotas
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(equipments.router, prefix="/api/equipments", tags=["Equipments"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["Quotes"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
