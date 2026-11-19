from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy import func, select

from app.db.models import CatalogSyncState


def integration(payload=None, status=200, fails=False):
    response = Mock(status_code=status)
    response.json.return_value = payload
    response.raise_for_status.side_effect = RuntimeError('private-upstream-error') if fails else None
    remote = AsyncMock()
    remote.get.return_value = response
    context = AsyncMock()
    context.__aenter__.return_value = remote
    return context, remote, response


@pytest.mark.parametrize('method,path', [
    ('GET', '/api/equipments/source-status'),
    ('POST', '/api/equipments/refresh-source'),
    ('POST', '/api/equipments/sync'),
])
async def test_inventory_control_requires_login_before_touching_integrations(client, method, path):
    with patch('app.api.equipments.httpx.AsyncClient') as remote:
        response = await client.request(method, path)
    assert response.status_code == 401
    remote.assert_not_called()


@pytest.mark.parametrize('method,path', [
    ('GET', '/api/equipments/source-status'),
    ('POST', '/api/equipments/refresh-source'),
    ('POST', '/api/equipments/sync'),
])
async def test_sales_cannot_trigger_inventory_or_inspect_raw_export(client, sales_user, method, path):
    with patch('app.api.equipments.httpx.AsyncClient') as remote:
        response = await client.request(method, path, headers={'Authorization': f'Bearer {sales_user[1]}'})
    assert response.status_code == 403
    remote.assert_not_called()


async def test_admin_reads_only_export_time_over_internal_endpoint(client, admin_user):
    payload = {'metadados': {'ultimaAtualizacao': '2026-11-17T12:00:00Z'}, 'estoque': [{'private': 'do-not-expose'}]}
    context, remote, _ = integration(payload)
    with patch('app.api.equipments.httpx.AsyncClient', return_value=context):
        response = await client.get('/api/equipments/source-status', headers={'Authorization': f'Bearer {admin_user[1]}'})
    assert response.status_code == 200
    assert response.json() == {'source_updated_at': '2026-11-17T12:00:00Z'}
    remote.get.assert_awaited_once_with('http://nginx:8080/catalogo.json')


async def test_first_export_can_be_requested_without_an_existing_file(client, admin_user):
    context, _, raw = integration(status=404)
    with patch('app.api.equipments.httpx.AsyncClient', return_value=context):
        response = await client.get('/api/equipments/source-status', headers={'Authorization': f'Bearer {admin_user[1]}'})
    assert response.status_code == 200
    assert response.json() == {'source_updated_at': None}
    raw.json.assert_not_called()


async def test_refresh_acceptance_is_not_reported_as_import_success(client, admin_user, db_session):
    context, remote, raw = integration()
    with patch('app.api.equipments.httpx.AsyncClient', return_value=context):
        response = await client.post('/api/equipments/refresh-source', headers={'Authorization': f'Bearer {admin_user[1]}'})
    assert response.status_code == 202
    remote.get.assert_awaited_once_with('http://n8n:5678/webhook/atualizar_estoque')
    raw.json.assert_not_called()
    assert (await db_session.execute(select(func.count()).select_from(CatalogSyncState))).scalar_one() == 0


@pytest.mark.parametrize('path', ['source-status', 'refresh-source'])
async def test_upstream_errors_do_not_expose_details_or_confirm_import(client, admin_user, db_session, path):
    context, _, _ = integration(fails=True)
    with patch('app.api.equipments.httpx.AsyncClient', return_value=context):
        response = await client.request('GET' if path == 'source-status' else 'POST', '/api/equipments/' + path,
                                        headers={'Authorization': f'Bearer {admin_user[1]}'})
    assert response.status_code == 502
    assert 'private-upstream-error' not in response.text
    assert (await db_session.execute(select(func.count()).select_from(CatalogSyncState))).scalar_one() == 0


async def test_invalid_export_is_not_exposed_to_browser(client, admin_user):
    context, _, _ = integration({'not-an-inventory': ['private']})
    with patch('app.api.equipments.httpx.AsyncClient', return_value=context):
        response = await client.get('/api/equipments/source-status', headers={'Authorization': f'Bearer {admin_user[1]}'})
    assert response.status_code == 502
    assert 'not-an-inventory' not in response.text
