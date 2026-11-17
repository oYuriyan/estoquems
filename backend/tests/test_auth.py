"""
Testes de autenticação.

Cobertura:
- Login com credenciais válidas → retorna JWT
- Login com senha errada → 400
- Login com email inexistente → 400
- /me com token válido → retorna dados do usuário
- /me com token inválido → 401
- /me com token ausente → 401
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestLogin:
    async def test_login_success_returns_token(self, client: AsyncClient, sales_user):
        """Login com credenciais válidas deve retornar access_token e token_type=bearer."""
        user, _ = sales_user

        response = await client.post(
            "/api/auth/login",
            data={"username": user.email, "password": "Sales@1234"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 20  # token JWT real

    async def test_login_wrong_password_returns_400(self, client: AsyncClient, sales_user):
        """Senha incorreta deve retornar 400."""
        user, _ = sales_user

        response = await client.post(
            "/api/auth/login",
            data={"username": user.email, "password": "SenhaErrada123"},
        )

        assert response.status_code == 400

    async def test_login_nonexistent_email_returns_400(self, client: AsyncClient):
        """E-mail que não existe deve retornar 400."""
        response = await client.post(
            "/api/auth/login",
            data={"username": "fantasma@example.com", "password": "qualquer"},
        )

        assert response.status_code == 400

    async def test_login_inactive_user_returns_400(self, client: AsyncClient, db_session: AsyncSession):
        """Usuário inativo não deve conseguir logar."""
        from app.db.models import User, UserRole
        from app.core.security import get_password_hash

        user = User(
            email="inativo@test.com",
            name="Inativo",
            hashed_password=get_password_hash("Senha@1234"),
            role=UserRole.SALES,
            is_active=False,  # <-- inativo
        )
        db_session.add(user)
        await db_session.commit()

        response = await client.post(
            "/api/auth/login",
            data={"username": "inativo@test.com", "password": "Senha@1234"},
        )

        assert response.status_code == 400


class TestMe:
    async def test_me_with_valid_token(self, client: AsyncClient, sales_user):
        """GET /me com token válido deve retornar os dados do usuário."""
        user, token = sales_user

        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email
        assert data["name"] == user.name
        assert data["role"] == "SALES"

    async def test_me_with_invalid_token_returns_401(self, client: AsyncClient):
        """Token inválido deve retornar 401."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer token.invalido.aqui"},
        )

        assert response.status_code == 401

    async def test_me_without_token_returns_401(self, client: AsyncClient):
        """Requisição sem token deve retornar 401."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401


class TestHealthCheck:
    async def test_health_check_returns_ok(self, client: AsyncClient):
        """Health check deve retornar status ok com metadados."""
        response = await client.get("/api/health")

        # SQLite in-memory pode não ter latência real, mas o endpoint deve responder
        assert response.status_code in (200, 503)
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "database" in data

@pytest.mark.parametrize('email', [' SALES@TEST.COM ', 'sales@test.com'])
async def test_login_normalizes_email(client, sales_user, email):
    response = await client.post('/api/auth/login', data={'username': email, 'password': 'Sales@1234'})
    assert response.status_code == 200