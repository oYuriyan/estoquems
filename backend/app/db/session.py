from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings

settings = get_settings()

engine_options = {"echo": False, "future": True}
if not settings.DATABASE_URL.startswith("sqlite"):
    engine_options.update(pool_size=20, max_overflow=10)
engine = create_async_engine(settings.DATABASE_URL, **engine_options)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
