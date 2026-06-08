from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn
from functools import lru_cache

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Micro Estoque API"
    APP_ENV: str = "production"
    
    # DB
    DATABASE_URL: str
    
    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3030"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
