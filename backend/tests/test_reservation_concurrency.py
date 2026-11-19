"""Concorrência em PostgreSQL isolado; nunca utiliza o banco operacional."""
import asyncio
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.main import app
from app.db.session import get_db
from test_equipments_quotes import create_equipment, create_draft_quote

pytestmark = pytest.mark.usefixtures('fresh_catalog')


@pytest.mark.asyncio
async def test_only_one_concurrent_quote_can_reserve_equipment(client, db_session, sales_user):
    if db_session.bind.dialect.name != 'postgresql':
        pytest.skip('Bloqueio concorrente exige o PostgreSQL de testes isolado.')
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='CONCURRENCY')
    quotes = [await create_draft_quote(db_session, user, equipment) for _ in range(5)]
    sessions = async_sessionmaker(db_session.bind, expire_on_commit=False)

    async def independent_session():
        async with sessions() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = independent_session
    response = Mock()
    response.json.return_value = {'sucesso': True}
    integration = AsyncMock()
    async def acknowledge(*args, **kwargs):
        payload = kwargs['json']
        response.json.return_value = {'sucesso': True, 'operationId': payload['operationId'], 'results': [{'idGlpi': i['idGlpi'], 'operationId': payload['operationId'], 'status': 'confirmed'} for i in payload['itens']]}
        await asyncio.sleep(0.05)
        return response
    integration.post.side_effect = acknowledge
    context = AsyncMock()
    context.__aenter__.return_value = integration
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        responses = await asyncio.gather(*[
            client.post(f'/api/quotes/{quote.id}/reserve', headers={'Authorization': f'Bearer {token}'})
            for quote in quotes
        ])
    assert sorted(result.status_code for result in responses) == [200, 409, 409, 409, 409]
    assert integration.post.await_count == 1
