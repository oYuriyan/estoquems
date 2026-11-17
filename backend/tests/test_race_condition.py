import pytest
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.db.models import Equipment, User, Quote, QuoteStatus
from app.core.security import create_access_token
import uuid
pytestmark = pytest.mark.skip(reason='Teste legado contra o ambiente operacional. Use test_reservation_concurrency.py com PostgreSQL isolado.')

# URL base da API quando rodando de fora do Docker ou usando httpx direto contra a API no docker
BASE_URL = "http://localhost:8000"

async def setup_test_data():
    """
    Cria 1 equipamento, 1 usuário e 5 propostas em draft para o mesmo usuário testar concorrência.
    Retorna os IDs para o teste e o token.
    """
    from app.db.session import engine
    await engine.dispose()
    async with AsyncSessionLocal() as db:
        # Create user
        user_email = f"test_race_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=user_email, name="Race Tester", hashed_password="fake", role="SALES")
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Create equipment
        eq_patrimonio = f"RACE-{uuid.uuid4().hex[:6]}"
        eq = Equipment(
            id_patrimonio=eq_patrimonio,
            numero_serie="SERIE-123",
            id_glpi="GLPI-TEST",
            marca="DELL",
            modelo="Optiplex Test",
            tipo="DESKTOP",
            status="DISPONIVEL NOVO",
            is_reserved=False,
            especificacoes={}
        )
        db.add(eq)
        await db.commit()
        await db.refresh(eq)

        # Create 5 quotes (drafts) referencing this equipment
        quote_ids = []
        for i in range(5):
            q = Quote(name=f"Draft {i}", salesperson_id=user.id, status=QuoteStatus.DRAFT)
            db.add(q)
            await db.commit()
            await db.refresh(q)
            quote_ids.append(q.id)
            
            # Use HTTP to add item to quote (simpler to use the actual app logic) or add directly to DB
            # We add to db directly to save time
            from app.db.models import QuoteItem
            db.add(QuoteItem(quote_id=q.id, equipment_id=eq.id))
            await db.commit()

        token = create_access_token(subject=user.email)
        return token, quote_ids, eq.id, user.id

async def cleanup_test_data(user_id: str, eq_id: str):
    async with AsyncSessionLocal() as db:
        from sqlalchemy import delete
        from app.db.models import QuoteItem
        
        # Primeiro acha todos os quotes_ids desse user
        from sqlalchemy.future import select
        res = await db.execute(select(Quote.id).where(Quote.salesperson_id == user_id))
        q_ids = res.scalars().all()
        
        if q_ids:
            await db.execute(delete(QuoteItem).where(QuoteItem.quote_id.in_(q_ids)))
        
        await db.execute(delete(Quote).where(Quote.salesperson_id == user_id))
        await db.execute(delete(Equipment).where(Equipment.id == eq_id))
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()

@pytest.mark.asyncio
async def test_race_condition_reservation():
    """
    Testa se 5 requisições de reserva ao mesmo tempo para o mesmo equipamento
    resultam em exatamente 1 sucesso e 4 falhas (409 Conflict ou bloqueio).
    """
    token, quote_ids, eq_id, user_id = await setup_test_data()
    
    headers = {"Authorization": f"Bearer {token}"}
    
    async def make_reservation(client, quote_id):
        response = await client.post(f"{BASE_URL}/api/quotes/{quote_id}/reserve", headers=headers)
        if response.status_code == 500:
            print(f"Erro 500 no quote {quote_id}: {response.text}")
        return response.status_code

    try:
        # Usa timeout alto porque os workers vão ficar travados esperando o lock
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Lança as 5 requisições *simultaneamente*
            tasks = [make_reservation(client, q_id) for q_id in quote_ids]
            results = await asyncio.gather(*tasks)

        # Analisando resultados
        success_count = results.count(200)
        conflict_count = results.count(409)

        print(f"\\nResultados da corrida: {results}")
        
        # A magia da integridade: Só 1 pode ganhar a corrida!
        assert success_count == 1, f"Era esperado exatamente 1 sucesso, tivemos {success_count}"
        assert conflict_count == 4, f"Era esperado 4 conflitos (409), tivemos {conflict_count}"
    
    finally:
        await cleanup_test_data(user_id, eq_id)
