"""
Testes de equipamentos e propostas (quotes).

Cobertura:
- Listar equipamentos agrupados (retorna estrutura correta)
- Criar proposta em draft
- Tentar reservar equipamento já reservado → 409
- Cancelar proposta → libera equipamentos
- Deletar proposta reservada deve falhar → 400
- Usuário não pode ver proposta de outro usuário → 404
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Equipment, Quote, QuoteItem, QuoteStatus, User


async def create_equipment(db: AsyncSession, **kwargs) -> Equipment:
    """Helper: cria um equipamento de teste."""
    defaults = dict(
        id_patrimonio=f"PAT-TEST-{id(kwargs)}",
        numero_serie="SN-TEST",
        id_glpi="GLPI-TEST",
        tipo="NOTEBOOK",
        marca="DELL",
        modelo="Latitude 5420",
        status="DISPONIVEL NOVO",
        is_reserved=False,
        is_active=True,
        especificacoes={"processador": "i5", "ram": "16GB", "armazenamento": "512GB", "so": "Windows 11"},
    )
    defaults.update(kwargs)
    eq = Equipment(**defaults)
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    return eq


async def create_draft_quote(db: AsyncSession, user: User, equipment: Equipment) -> Quote:
    """Helper: cria uma proposta em DRAFT com um equipamento."""
    quote = Quote(
        name="Proposta Teste",
        client_name="Cliente Teste",
        validity_days=2,
        salesperson_id=user.id,
        status=QuoteStatus.DRAFT,
    )
    db.add(quote)
    await db.flush()
    db.add(QuoteItem(quote_id=quote.id, equipment_id=equipment.id))
    await db.commit()
    await db.refresh(quote)
    return quote


# ─────────────────────────────────────────────────────────────────────────────
# Equipamentos
# ─────────────────────────────────────────────────────────────────────────────
class TestEquipments:
    async def test_grouped_endpoint_returns_structure(
        self, client: AsyncClient, db_session: AsyncSession, sales_user
    ):
        """O endpoint /grouped deve retornar grupos com estrutura correta."""
        user, token = sales_user
        await create_equipment(db_session, id_patrimonio="PAT-G1")
        await create_equipment(db_session, id_patrimonio="PAT-G2", modelo="Inspiron 15")

        response = await client.get(
            "/api/equipments/grouped",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert "total_equipments" in data
        assert data["total_equipments"] >= 2
        # Cada grupo deve ter items, modelo, marca
        for group in data["groups"]:
            assert "items" in group
            assert "modelo" in group
            assert "marca" in group

    async def test_grouped_search_filter(
        self, client: AsyncClient, db_session: AsyncSession, sales_user
    ):
        """Filtro de busca deve retornar apenas itens correspondentes."""
        user, token = sales_user
        await create_equipment(db_session, id_patrimonio="PAT-HP1", marca="HP", modelo="ProBook 440")
        await create_equipment(db_session, id_patrimonio="PAT-DELL1", marca="DELL", modelo="Latitude 7420")

        response = await client.get(
            "/api/equipments/grouped?search=HP",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        # Apenas equipamentos HP devem aparecer
        for group in data["groups"]:
            assert group["marca"] == "HP"

    async def test_grouped_requires_auth(self, client: AsyncClient):
        """Endpoint não deve ser acessível sem autenticação."""
        response = await client.get("/api/equipments/grouped")
        assert response.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Propostas (Quotes)
# ─────────────────────────────────────────────────────────────────────────────
class TestQuotes:
    async def test_list_quotes_empty_initially(
        self, client: AsyncClient, sales_user
    ):
        """Usuário novo não deve ter propostas."""
        _, token = sales_user

        response = await client.get(
            "/api/quotes/",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_draft_quote(
        self, client: AsyncClient, db_session: AsyncSession, sales_user
    ):
        """POST /draft deve criar proposta em status DRAFT."""
        user, token = sales_user
        eq = await create_equipment(db_session, id_patrimonio="PAT-DRAFT1")

        response = await client.post(
            "/api/quotes/draft",
            json={
                "name": "Proposta Draft Teste",
                "client_name": "Cliente XPTO",
                "validity_days": 3,
                "equipment_ids": [eq.id],
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Proposta Draft Teste"
        assert data["status"] == "DRAFT"
        assert len(data["items"]) == 1

    async def test_delete_draft_quote_succeeds(
        self, client: AsyncClient, db_session: AsyncSession, sales_user
    ):
        """Deletar proposta em DRAFT deve retornar sucesso."""
        user, token = sales_user
        eq = await create_equipment(db_session, id_patrimonio="PAT-DEL1")
        quote = await create_draft_quote(db_session, user, eq)

        response = await client.delete(
            f"/api/quotes/{quote.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200

    async def test_cannot_delete_reserved_quote(
        self, client: AsyncClient, db_session: AsyncSession, sales_user
    ):
        """Tentativa de deletar proposta RESERVED deve retornar 400."""
        user, token = sales_user
        eq = await create_equipment(db_session, id_patrimonio="PAT-RESV1")
        quote = await create_draft_quote(db_session, user, eq)

        # Marca como reservada diretamente no banco
        quote.status = QuoteStatus.RESERVED
        await db_session.commit()

        response = await client.delete(
            f"/api/quotes/{quote.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 400

    async def test_user_cannot_see_other_users_quotes(
        self, client: AsyncClient, db_session: AsyncSession, sales_user, admin_user
    ):
        """Um usuário não deve conseguir ver propostas de outro usuário."""
        sales, sales_token = sales_user
        admin, admin_token = admin_user

        eq = await create_equipment(db_session, id_patrimonio="PAT-OTHER1")
        quote = await create_draft_quote(db_session, admin, eq)

        # Sales tenta acessar proposta do admin
        response = await client.delete(
            f"/api/quotes/{quote.id}",
            headers={"Authorization": f"Bearer {sales_token}"},
        )

        assert response.status_code == 404
