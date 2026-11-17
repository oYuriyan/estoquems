"""Regressões de disponibilidade e reservas, com GLPI/n8n simulados."""
from unittest.mock import AsyncMock, Mock, patch

import pytest
from app.db.models import QuoteStatus
from test_equipments_quotes import create_equipment, create_draft_quote


def webhook_client(fails=False):
    response = Mock()
    response.json.return_value = {'sucesso': True}
    response.raise_for_status.side_effect = RuntimeError("integração indisponível") if fails else None
    client = AsyncMock()
    client.post.return_value = response
    context = AsyncMock()
    context.__aenter__.return_value = client
    return context, client


@pytest.mark.asyncio
async def test_catalog_separates_available_reserved_and_inactive(client, db_session, sales_user):
    _, token = sales_user
    await create_equipment(db_session, id_patrimonio="FREE", status="DISPONIVEL NOVO")
    await create_equipment(db_session, id_patrimonio="RESERVED", status="DISPONIVEL NOVO", is_reserved=True)
    await create_equipment(db_session, id_patrimonio="INACTIVE", is_active=False)
    response = await client.get('/api/equipments/grouped', headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    assert data['total_equipments'] == 2
    assert data['total_available'] == 1
    assert data['total_reserved'] == 1
    assert data['total_novos'] == 1
    assert data['groups'][0]['available_count'] == 1
    assert data['groups'][0]['reserved_count'] == 1
    assert sorted(item['is_available'] for item in data['groups'][0]['items']) == [False, True]


@pytest.mark.asyncio
async def test_grouping_keeps_brand_and_screen_variants_separate(client, db_session, sales_user):
    _, token = sales_user
    for key, brand, screen in [('A', 'DELL', '14'), ('B', 'HP', '14'), ('C', 'DELL', '16')]:
        await create_equipment(db_session, id_patrimonio=key, marca=brand,
                               especificacoes={"processador": "i5", "ram": "16GB", "armazenamento": "512GB", "so": "Windows 11", "tela": screen})
    response = await client.get('/api/equipments/grouped', headers={"Authorization": f"Bearer {token}"})
    assert response.json()['total_groups'] == 3


@pytest.mark.asyncio
async def test_used_equipment_is_not_counted_as_new(client, db_session, sales_user):
    _, token = sales_user
    await create_equipment(db_session, id_patrimonio='USED', status='DISPONIVEL USADO')
    response = await client.get('/api/equipments/grouped?status_filter=NOVO', headers={"Authorization": f"Bearer {token}"})
    assert response.json()['total_equipments'] == 0
    response = await client.get('/api/equipments/grouped?status_filter=USADO', headers={"Authorization": f"Bearer {token}"})
    assert response.json()['total_available'] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('equipment_status,active,reserved', [
    ('DISPONIVEL USADO', True, True), ('RESERVADO NOVO', True, False),
    ('EM MANUTENÇÃO', True, False), ('DISPONIVEL', False, False),
    ('', True, False), ('USADO', True, False), ('NOVO', True, False),
    ('DESCONHECIDO', True, False), ('AGUARDANDO TRIAGEM', True, False),
    ('NÃO DISPONÍVEL', True, False), ('DISPONIVEL EM MANUTENCAO', True, False),
    ('LOCADO', True, False), ('VENDIDO', True, False), ('RMA', True, False),
    ('DISPONIVEL', True, False), ('DISPONIVEL SEMINOVO', True, False),
])
async def test_cannot_reserve_unavailable_equipment(client, db_session, sales_user, equipment_status, active, reserved):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='BLOCKED', status=equipment_status, is_active=active, is_reserved=reserved)
    quote = await create_draft_quote(db_session, user, equipment)
    with patch('app.api.quotes.httpx.AsyncClient') as integration:
        response = await client.post(f'/api/quotes/{quote.id}/reserve', headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 409
        integration.assert_not_called()


@pytest.mark.asyncio
async def test_reserve_persists_server_timestamp(client, db_session, sales_user):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='TIMESTAMP')
    quote = await create_draft_quote(db_session, user, equipment)
    context, integration = webhook_client()
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote.id}/reserve', headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()['status'] == 'RESERVED'
    assert response.json()['reserved_at'] is not None
    assert response.json()['items'][0]['is_reserved'] is True
    assert integration.post.call_args.kwargs['json']['propostaId'] == quote.id
    await db_session.refresh(equipment)
    assert equipment.inventory_confirmed_at is not None


@pytest.mark.asyncio
async def test_cancel_draft_cannot_release_another_quote(client, db_session, sales_user):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='OTHER', is_reserved=True)
    reserved = await create_draft_quote(db_session, user, equipment)
    reserved.status = QuoteStatus.RESERVED
    draft = await create_draft_quote(db_session, user, equipment)
    await db_session.commit()
    with patch('app.api.quotes.httpx.AsyncClient') as integration:
        response = await client.post(f'/api/quotes/{draft.id}/cancel', headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 400
        integration.assert_not_called()
    await db_session.refresh(equipment)
    assert equipment.is_reserved is True


@pytest.mark.asyncio
async def test_cancel_keeps_reservation_when_glpi_fails(client, db_session, sales_user):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='KEEP', is_reserved=True)
    quote = await create_draft_quote(db_session, user, equipment)
    quote.status = QuoteStatus.RESERVED
    await db_session.commit()
    quote_id = quote.id
    context, _ = webhook_client(fails=True)
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote_id}/cancel', headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 502
    await db_session.refresh(equipment)
    await db_session.refresh(quote)
    assert equipment.is_reserved is True
    assert quote.status == QuoteStatus.RESERVED
    assert equipment.inventory_confirmed_at is None


@pytest.mark.asyncio
async def test_cancel_confirmed_releases_stock_and_cannot_rereserve(client, db_session, sales_user):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='RELEASE', is_reserved=True)
    quote = await create_draft_quote(db_session, user, equipment)
    quote.status = QuoteStatus.RESERVED
    await db_session.commit()
    context, _ = webhook_client()
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote.id}/cancel', headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    await db_session.refresh(equipment)
    assert equipment.is_reserved is False
    response = await client.post(f'/api/quotes/{quote.id}/reserve', headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_draft_rejects_duplicate_or_missing_equipment(client, db_session, sales_user):
    _, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='UNIQUE')
    for ids, expected in [([equipment.id, equipment.id], 422), (['missing-id'], 404)]:
        response = await client.post('/api/quotes/draft', json={"name": "Teste", "equipment_ids": ids}, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == expected


@pytest.mark.asyncio
async def test_http_200_conflict_from_n8n_is_not_a_success(client, db_session, sales_user):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='REMOTE-CONFLICT')
    quote = await create_draft_quote(db_session, user, equipment)
    quote_id = quote.id
    context, integration = webhook_client()
    integration.post.return_value.json.return_value = {'erro': 'Já reservado no GLPI'}
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote_id}/reserve', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 409
    await db_session.refresh(equipment)
    await db_session.refresh(quote)
    assert equipment.is_reserved is False
    assert quote.status == QuoteStatus.DRAFT
