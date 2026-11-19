"""
conftest.py — Fixtures compartilhadas para todos os testes.

Usa SQLite em memória para testes unitários rápidos (sem Docker).
Para concorrência, TEST_DATABASE_URL aponta para PostgreSQL de testes isolado.
O teste legado contra o ambiente operacional foi substituído.
"""
import os
from datetime import datetime, timezone
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.models import Base, User, UserRole, CatalogSyncState
from app.db.session import get_db
from app.core.security import create_access_token, get_password_hash

# ─────────────────────────────────────────────────────────────────────────────
# Banco em memória (SQLite async)
# ─────────────────────────────────────────────────────────────────────────────
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """
    Sessão de banco de dados isolada para cada teste.
    Cria todas as tabelas, roda o teste, e destrói.
    """
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def fresh_catalog(db_session):
    stamp = datetime.now(timezone.utc)
    state = CatalogSyncState(id=1, source_updated_at=stamp, synced_at=stamp, fingerprint='isolated-test-snapshot')
    db_session.add(state)
    await db_session.commit()
    return state


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    """
    Cliente HTTP da app FastAPI com banco de teste injetado.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Lummium-Operations":"1"},
    ) as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> tuple[User, str]:
    """Cria um usuário ADMIN e retorna (user, token)."""
    user = User(
        email="admin@test.com",
        name="Admin Test",
        hashed_password=get_password_hash("Admin@1234"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(subject=user.email)
    return user, token


@pytest_asyncio.fixture(scope="function")
async def sales_user(db_session: AsyncSession) -> tuple[User, str]:
    """Cria um usuário SALES e retorna (user, token)."""
    user = User(
        email="sales@test.com",
        name="Sales Test",
        hashed_password=get_password_hash("Sales@1234"),
        role=UserRole.SALES,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(subject=user.email)
    return user, token
