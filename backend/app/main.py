from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, equipments, quotes
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

# Inclui as rotas
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(equipments.router, prefix="/api/equipments", tags=["Equipments"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["Quotes"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
