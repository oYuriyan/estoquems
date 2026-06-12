from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Lummium API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "production"

    # DB
    DATABASE_URL: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3030"

    # Observabilidade
    SENTRY_DSN: str = ""          # Preencher junto com o Sentry dashboard
    LOG_LEVEL: str = "INFO"

    # Rate Limiting (requisições por minuto por IP)
    RATE_LIMIT_PER_MINUTE: int = 120

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
