from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.catalog_status import catalog_status
from app.catalog_sync import catalog_synchronizer
from app.db.models import QuoteStatus
from test_equipments_quotes import create_equipment, create_draft_quote
from test_inventory_reservations import webhook_client


@pytest.mark.parametrize('age,status', [(0, 'fresh'), (48, 'fresh'), (48.001, 'stale'), (-1, 'invalid')])
def test_freshness_uses_source_time_and_exact_configured_limit(age, status):
    now = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)
    state = SimpleNamespace(source_updated_at=now - timedelta(hours=age), synced_at=now)
    result = catalog_status(state, now=now, max_age_hours=48)
    assert result['inventory_status'] == status
    assert result['reservation_allowed'] == (status == 'fresh')
    assert (result['reservation_block_reason'] is None) == (status == 'fresh')


def test_configured_limit_and_timezone_are_respected():
    now = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)
    source = (now - timedelta(hours=13)).astimezone(timezone(timedelta(hours=-3)))
    result = catalog_status(SimpleNamespace(source_updated_at=source, synced_at=now), now=now, max_age_hours=12)
    assert result['inventory_status'] == 'stale'
    assert result['catalog_max_age_hours'] == 12


async def test_catalog_without_validated_snapshot_remains_readable_but_cannot_reserve(client, sales_user, db_session):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='UNVERIFIED')
    quote = await create_draft_quote(db_session, user, equipment)
    headers = {'Authorization': f'Bearer {token}'}
    grouped = await client.get('/api/equipments/grouped', headers=headers)
    assert grouped.status_code == 200
    assert grouped.json()['total_equipments'] == 1
    assert grouped.json()['inventory_status'] == 'unverified'
    assert grouped.json()['reservation_allowed'] is False
    with patch('app.api.quotes.httpx.AsyncClient') as integration:
        response = await client.post(f'/api/quotes/{quote.id}/reserve', headers=headers)
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'inventory_unverified'
    integration.assert_not_called()
    await db_session.refresh(quote)
    await db_session.refresh(equipment)
    assert quote.status == QuoteStatus.DRAFT
    assert equipment.is_reserved is False


@pytest.mark.parametrize('age,status', [(49, 'stale'), (-2, 'invalid')])
async def test_invalid_source_time_blocks_reservation_without_remote_effects(client, sales_user, db_session, fresh_catalog, age, status):
    user, token = sales_user
    fresh_catalog.source_updated_at = datetime.now(timezone.utc) - timedelta(hours=age)
    # A recent import/consultation cannot make an old source snapshot fresh.
    fresh_catalog.synced_at = datetime.now(timezone.utc)
    await db_session.commit()
    equipment = await create_equipment(db_session, id_patrimonio='STALE')
    quote = await create_draft_quote(db_session, user, equipment)
    with patch('app.api.quotes.httpx.AsyncClient') as integration:
        response = await client.post(f'/api/quotes/{quote.id}/reserve', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'inventory_' + status
    integration.assert_not_called()
    await db_session.refresh(equipment)
    await db_session.refresh(quote)
    assert equipment.is_reserved is False
    assert equipment.inventory_confirmed_at is None
    assert quote.status == QuoteStatus.DRAFT


async def test_metadata_comes_from_database_even_when_process_cache_is_empty(client, sales_user, fresh_catalog, monkeypatch):
    monkeypatch.setattr(catalog_synchronizer, 'source_updated_at', None)
    monkeypatch.setattr(catalog_synchronizer, 'synced_at', None)
    response = await client.get('/api/equipments/grouped', headers={'Authorization': f'Bearer {sales_user[1]}'})
    data = response.json()
    assert data['inventory_status'] == 'fresh'
    assert data['reservation_allowed'] is True
    assert data['source_updated_at'] is not None
    assert data['synced_at'] is not None
    assert data['inventory_fresh_until'] is not None


async def test_fresh_snapshot_allows_reservation_after_process_restart(client, sales_user, db_session, fresh_catalog, monkeypatch):
    monkeypatch.setattr(catalog_synchronizer, 'source_updated_at', None)
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='FRESH')
    quote = await create_draft_quote(db_session, user, equipment)
    context, integration = webhook_client()
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote.id}/reserve', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    assert integration.post.await_count == 1


async def test_confirmed_cancellation_does_not_require_a_fresh_snapshot(client, sales_user, db_session):
    user, token = sales_user
    equipment = await create_equipment(db_session, id_patrimonio='CANCEL', is_reserved=True)
    quote = await create_draft_quote(db_session, user, equipment)
    quote.status = QuoteStatus.RESERVED
    await db_session.commit()
    context, integration = webhook_client()
    with patch('app.api.quotes.httpx.AsyncClient', return_value=context):
        response = await client.post(f'/api/quotes/{quote.id}/cancel', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    assert integration.post.await_count == 1
    await db_session.refresh(equipment)
    assert equipment.is_reserved is False
