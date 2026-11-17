import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from app.api.recovery import limiter

@pytest.fixture(autouse=True)
def clear_limits():
    limiter.reset()

async def issue(client, email):
    with patch('app.api.recovery.mail_ready', return_value=True), patch('app.api.recovery.send_reset_email') as send:
        response = await client.post('/api/auth/forgot-password', json={'email': email})
        return response, send.call_args.args[1] if send.called else None

async def test_reset_single_use_revokes_sessions(client, sales_user, db_session):
    user, old_token = sales_user
    response, token = await issue(client, user.email)
    assert response.status_code == 202
    await db_session.refresh(user)
    assert user.reset_token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in response.text
    body = {'token': token, 'password': 'Uma frase nova e exclusiva!'}
    assert (await client.post('/api/auth/reset-password', json=body)).status_code == 200
    assert (await client.post('/api/auth/reset-password', json=body)).status_code == 400
    assert (await client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + old_token})).status_code == 401
    assert (await client.post('/api/auth/login', data={'username': user.email, 'password': 'Sales@1234'})).status_code == 400
    login = await client.post('/api/auth/login', data={'username': user.email, 'password': body['password']})
    assert login.status_code == 200
    assert (await client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + login.json()['access_token']})).status_code == 200

async def test_generic_response_and_cooldown(client, sales_user):
    user, _ = sales_user
    email = user.email
    known, token = await issue(client, email)
    unknown, missing = await issue(client, 'missing@example.com')
    repeated, suppressed = await issue(client, email)
    assert known.json() == unknown.json() == repeated.json()
    assert token and missing is None and suppressed is None

async def test_expiry_and_inactive_account(client, sales_user, db_session):
    user, _ = sales_user
    _, token = await issue(client, user.email)
    user.reset_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    body = {'token': token, 'password': 'Uma frase nova e exclusiva!'}
    assert (await client.post('/api/auth/reset-password', json=body)).status_code == 400
    user.reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    user.is_active = False
    await db_session.commit()
    assert (await client.post('/api/auth/reset-password', json=body)).status_code == 400

async def test_invalid_token_and_password_policy(client, sales_user):
    user, _ = sales_user
    _, token = await issue(client, user.email)
    assert (await client.post('/api/auth/reset-password', json={'token': 'x'*43, 'password': 'Uma frase bem longa!'})).status_code == 400
    for password in ['short', 'é'*40, ' '*12]:
        assert (await client.post('/api/auth/reset-password', json={'token': token, 'password': password})).status_code == 422

async def test_rate_limit(client):
    for _ in range(5):
        await issue(client, 'missing@example.com')
    response, _ = await issue(client, 'missing@example.com')
    assert response.status_code == 429

async def test_missing_smtp_returns_unavailable(client):
    with patch('app.api.recovery.mail_ready', return_value=False):
        response = await client.post('/api/auth/forgot-password', json={'email': 'missing@example.com'})
    assert response.status_code == 503
