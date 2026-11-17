from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import select
from app.catalog_sync import CatalogSynchronizer
from app.db.models import Equipment
from app.inventory import is_available
from test_equipments_quotes import create_equipment


def source(payload):
    payloads = payload if isinstance(payload, list) else [payload]
    for entry in payloads:
        if isinstance(entry, dict) and 'metadados' not in entry:
            entry['metadados'] = {'ultimaAtualizacao': datetime.now(timezone.utc).isoformat()}
    response = Mock()
    response.json.return_value = payload
    client = AsyncMock()
    client.get.return_value = response
    context = AsyncMock()
    context.__aenter__.return_value = client
    return patch('app.catalog_sync.httpx.AsyncClient', return_value=context)


@pytest.mark.asyncio
async def test_import_updates_stock_and_preserves_local_reservation(db_session):
    reserved = await create_equipment(db_session, id_patrimonio='KEEP', status='DISPONIVEL NOVO', is_reserved=True)
    removed = await create_equipment(db_session, id_patrimonio='REMOVE')
    synchronizer = CatalogSynchronizer()
    stamp = datetime.now(timezone.utc).isoformat()
    payload = {'metadados': {'ultimaAtualizacao': stamp}, 'estoque': [
        {'idPatrimonio': 'KEEP', 'idGlpi': '10', 'numeroSerie': 'KEEP-SN', 'tipo': 'NOTEBOOK', 'marca': 'DELL', 'modelo': 'Latitude', 'status': 'RESERVADO NOVO', 'especificacoes': {}},
        {'idPatrimonio': 'NEW', 'idGlpi': '11', 'numeroSerie': 'NEW-SN', 'tipo': 'NOTEBOOK', 'marca': 'DELL', 'modelo': 'Pro', 'status': 'DISPONIVEL NOVO', 'especificacoes': {}},
    ]}
    with source([payload]):
        assert await synchronizer.sync(db_session) is True
        assert await synchronizer.sync(db_session) is False
    await db_session.refresh(reserved)
    await db_session.refresh(removed)
    assert reserved.is_reserved is True
    assert reserved.status == 'DISPONIVEL NOVO'
    assert removed.is_active is False
    assert (await db_session.execute(select(Equipment).where(Equipment.id_patrimonio == 'NEW'))).scalar_one().is_active is True
    assert synchronizer.source_updated_at == stamp


@pytest.mark.asyncio
@pytest.mark.parametrize('payload', [
    {'unexpected': []}, {'estoque': []}, {'estoque': [{'modelo': 'sem identificação'}]},
    {'estoque': [{'idPatrimonio': 'DUPLICATE'}, {'idPatrimonio': 'DUPLICATE'}]},
    {'estoque': [{'idPatrimonio': 'N/A', 'numeroSerie': ''}]},
])
async def test_bad_inventory_cannot_deactivate_stock(db_session, payload):
    equipment = await create_equipment(db_session, id_patrimonio='PRESERVE')
    with source(payload), pytest.raises(ValueError):
        await CatalogSynchronizer().sync(db_session)
    await db_session.refresh(equipment)
    assert equipment.is_active is True


@pytest.mark.asyncio
@pytest.mark.parametrize('status', [None, '', '   ', 'USADO', 'AGUARDANDO TRIAGEM'])
async def test_import_never_turns_unknown_status_into_available_stock(db_session, status):
    equipment = await create_equipment(db_session, id_patrimonio='UNKNOWN', status='DISPONIVEL NOVO')
    payload = {'estoque': [{'idPatrimonio': 'UNKNOWN', 'status': status}]}
    with source(payload):
        await CatalogSynchronizer().sync(db_session)
    await db_session.refresh(equipment)
    assert is_available(equipment) is False
    assert equipment.is_active is False
    assert equipment.status == 'DISPONIVEL NOVO'


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['LOCADO', 'VENDIDO', 'RMA', 'DISPONIVEL SEMINOVO', None])
async def test_out_of_scope_stock_is_not_created_and_existing_leaves_catalog(client, db_session, sales_user, status):
    _, token = sales_user
    existing = await create_equipment(db_session, id_patrimonio='OLD', is_reserved=True)
    payload = {'estoque': [
        {'idPatrimonio': 'OLD', 'status': status},
        {'idPatrimonio': 'OUTSIDE', 'status': status},
        {'idPatrimonio': 'FREE', 'status': 'DISPONIVEL USADO'},
    ]}
    with source(payload):
        await CatalogSynchronizer().sync(db_session)
    await db_session.refresh(existing)
    assert existing.is_active is False
    assert existing.is_reserved is True
    assert existing.status == 'DISPONIVEL NOVO'
    assert (await db_session.execute(select(Equipment).where(Equipment.id_patrimonio == 'OUTSIDE'))).scalar_one_or_none() is None
    headers = {'Authorization': f'Bearer {token}'}
    grouped = (await client.get('/api/equipments/grouped', headers=headers)).json()
    assert grouped['total_equipments'] == grouped['total_available'] == 1
    assert grouped['groups'][0]['items'][0]['idPatrimonio'] == 'FREE'
    listed = (await client.get('/api/equipments/', headers=headers)).json()
    assert len(listed) == 1


@pytest.mark.asyncio
async def test_equipment_returns_only_when_available_again(db_session):
    equipment = await create_equipment(db_session, id_patrimonio='RETURN', is_active=False)
    with source({'estoque': [{'idPatrimonio': 'RETURN', 'status': 'DISPONIVEL USADO'}]}):
        await CatalogSynchronizer().sync(db_session)
    await db_session.refresh(equipment)
    assert is_available(equipment)


@pytest.mark.asyncio
@pytest.mark.parametrize('status,expected', [
    ('LOCADO', 422), ('VENDIDO', 422), ('RMA', 422),
    ('DISPONIVEL NOVO', 200), ('DISPONIVEL USADO', 200),
])
async def test_manual_creation_respects_stock_scope(client, sales_user, status, expected):
    _, token = sales_user
    response = await client.post('/api/equipments/', headers={'Authorization': f'Bearer {token}'}, json={
        'id_patrimonio': 'MANUAL', 'id_glpi': '1', 'numero_serie': 'SN',
        'tipo': 'NOTEBOOK', 'marca': 'DELL', 'modelo': 'Test',
        'status': status, 'especificacoes': {},
    })
    assert response.status_code == expected


def dated_payload(stamp, status='DISPONIVEL USADO', identity='TIME'):
    return {'metadados': {'ultimaAtualizacao': stamp}, 'estoque': [
        {'idPatrimonio': identity, 'status': status},
    ]}


@pytest.mark.asyncio
@pytest.mark.parametrize('stamp', [None, '', 'invalid', '2026-01-01T12:00:00',
    '2020-01-01T00:00:00Z', '2099-01-01T00:00:00Z'])
async def test_invalid_snapshot_time_preserves_catalog(db_session, stamp):
    equipment = await create_equipment(db_session, id_patrimonio='TIME')
    with source(dated_payload(stamp, 'RMA')), pytest.raises(ValueError):
        await CatalogSynchronizer().sync(db_session, force=True)
    await db_session.refresh(equipment)
    assert equipment.is_active is True
    assert equipment.status == 'DISPONIVEL NOVO'


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time', [False, True])
async def test_restart_cannot_accept_older_or_rewritten_snapshot(db_session, same_time):
    stamp = datetime.now(timezone.utc) - timedelta(minutes=10)
    with source(dated_payload(stamp.isoformat())):
        await CatalogSynchronizer().sync(db_session)
    rejected_time = stamp if same_time else stamp - timedelta(minutes=1)
    with source(dated_payload(rejected_time.isoformat(), 'RMA')), pytest.raises(ValueError):
        await CatalogSynchronizer().sync(db_session, force=True)
    equipment = (await db_session.execute(select(Equipment).where(Equipment.id_patrimonio == 'TIME'))).scalar_one()
    assert is_available(equipment)


@pytest.mark.asyncio
async def test_unchanged_snapshot_restores_metadata_after_restart(db_session):
    payload = dated_payload((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat())
    with source(payload):
        original = CatalogSynchronizer()
        assert await original.sync(db_session)
        restarted = CatalogSynchronizer()
        assert not await restarted.sync(db_session)
    assert restarted.source_updated_at == original.source_updated_at
    assert restarted.synced_at == original.synced_at


@pytest.mark.asyncio
@pytest.mark.parametrize('snapshot_status', ['RMA', 'RESERVADO NOVO', 'DISPONIVEL USADO', None])
async def test_confirmed_cancel_survives_snapshot_before_operation(client, db_session, sales_user, snapshot_status):
    from test_equipments_quotes import create_draft_quote
    from test_inventory_reservations import webhook_client
    from app.db.models import QuoteStatus

    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='TIME', is_reserved=True, is_active=False)
    quote = await create_draft_quote(db_session, user, equipment)
    quote.status = QuoteStatus.RESERVED
    await db_session.commit()
    old_stamp = datetime.now(timezone.utc) - timedelta(minutes=1)
    context, _ = webhook_client()
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        result = await client.post(f'/api/quotes/{quote.id}/cancel', headers={'Authorization': f'Bearer {token}'})
    assert result.status_code == 200
    await db_session.refresh(equipment)
    assert equipment.inventory_confirmed_at is not None
    identity = 'OTHER' if snapshot_status is None else 'TIME'
    payload = dated_payload(old_stamp.isoformat(), snapshot_status or 'DISPONIVEL USADO', identity)
    with source(payload):
        await CatalogSynchronizer().sync(db_session, force=True)
    await db_session.refresh(equipment)
    assert equipment.is_reserved is False
    assert equipment.is_active is True
    assert equipment.status == 'DISPONIVEL NOVO'
    # Exportação posterior à confirmação volta a governar a presença no catálogo.
    later = equipment.inventory_confirmed_at.replace(tzinfo=timezone.utc) + timedelta(seconds=1)
    with patch('app.catalog_sync.datetime', wraps=datetime) as clock:
        clock.now.return_value = later + timedelta(seconds=1)
        with source(dated_payload(later.isoformat(), 'RMA')):
            await CatalogSynchronizer().sync(db_session)
    await db_session.refresh(equipment)
    assert equipment.is_active is False
