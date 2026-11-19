import json
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.db.models import Equipment, Quote, QuoteItem, QuoteStatus
from app.db.operations import QuoteOperation, OperationItem, OperationEvent
from app.services import operations
from test_equipments_quotes import create_equipment, create_draft_quote

pytestmark = [pytest.mark.asyncio, pytest.mark.usefixtures("fresh_catalog")]


def headers(token):
    return {"Authorization": "Bearer " + token}


async def operation_for(db, quote_id):
    return await operations.latest(db, quote_id)


class Remote:
    def __init__(self):
        self.states = {}
        self.writes = 0
        self.reads = 0
        self.partial = False
        self.timeout_after_write = False
        self.unknown = False

    async def __call__(self, operation, items, inspection=False):
        if inspection:
            self.reads += 1
            return {
                i.id_glpi: (
                    "unknown"
                    if self.unknown
                    else (
                        "reserved_by_quote"
                        if self.states.get(i.id_glpi) == operation.quote_id
                        else "available"
                    )
                )
                for i in items
            }
        self.writes += 1
        results = {}
        for index, item in enumerate(items):
            if self.partial and index:
                results[item.id_glpi] = "pending"
                continue
            self.states[item.id_glpi] = (
                operation.quote_id if operation.action == "reserve" else None
            )
            results[item.id_glpi] = "confirmed"
        if self.timeout_after_write:
            raise httpx.ReadTimeout("private token must never enter history")
        return results


async def fixture_quote(db, user, count=1):
    equipment = [
        await create_equipment(
            db, id_patrimonio="LEDGER-" + str(n), id_glpi=str(8000 + n)
        )
        for n in range(count)
    ]
    quote = await create_draft_quote(db, user, equipment[0])
    for e in equipment[1:]:
        db.add(QuoteItem(quote_id=quote.id, equipment_id=e.id))
    await db.commit()
    return quote, equipment


async def expire(db, operation):
    operation.lease_until = None
    await db.commit()


async def test_intent_and_claim_committed_before_external_effect(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)

    async def remote(operation, items, inspection=False):
        sessions = async_sessionmaker(db_session.bind, expire_on_commit=False)
        async with sessions() as independent:
            stored = await independent.get(QuoteOperation, operation.id)
            claimed = await independent.get(Equipment, equipment[0].id)
            assert (
                stored
                and stored.attempts == 1
                and claimed.reservation_operation_id == stored.id
            )
        return {i.id_glpi: "confirmed" for i in items}

    monkeypatch.setattr(operations, "call_remote", remote)
    response = await client.post(
        f"/api/quotes/{quote.id}/reserve", headers=headers(token)
    )
    assert response.status_code == 200
    assert response.json()["operation"]["status"] == "SUCCEEDED"
    events = (await db_session.execute(select(OperationEvent))).scalars().all()
    assert [e.kind for e in events] == ["created", "attempt_started", "result_received"]
    assert all(e.actor_id == user.id for e in events)


async def test_timeout_keeps_durable_claim_and_repeated_click_does_not_write(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    response = await client.post(
        f"/api/quotes/{quote.id}/reserve", headers=headers(token)
    )
    assert response.status_code == 202
    operation_id = response.json()["operation"]["id"]
    again = await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    assert again.status_code == 202 and again.json()["operation"]["id"] == operation_id
    assert remote.writes == 1
    await db_session.refresh(equipment[0])
    assert equipment[0].reservation_operation_id == operation_id
    assert (
        await client.put(
            f"/api/quotes/{quote.id}", json={"name": "Unsafe"}, headers=headers(token)
        )
    ).status_code == 409
    assert (
        await client.delete(f"/api/quotes/{quote.id}", headers=headers(token))
    ).status_code == 409
    catalog = (
        await client.get("/api/equipments/grouped", headers=headers(token))
    ).json()
    assert catalog["total_available"] == 0
    history = (
        await client.get(f"/api/quotes/{quote.id}/history", headers=headers(token))
    ).json()
    assert "private token" not in json.dumps(history)


async def test_read_only_reconciliation_after_restart_confirms_late_result(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    assert (
        await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    ).status_code == 202
    operation = await operation_for(db_session, quote.id)
    await expire(db_session, operation)
    # New session models recovery after the request process has gone away.
    sessions = async_sessionmaker(db_session.bind, expire_on_commit=False)
    async with sessions() as recovered:
        loaded = await recovered.get(QuoteOperation, operation.id)
        result = await operations.run(recovered, loaded, None, inspection=True)
        assert result.status == "SUCCEEDED"
    assert remote.writes == 1 and remote.reads == 1
    await db_session.refresh(equipment[0])
    await db_session.refresh(quote)
    assert equipment[0].is_reserved and equipment[0].reservation_operation_id is None
    assert quote.status == QuoteStatus.RESERVED


async def test_partial_reservation_can_finish_using_same_operation(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user, 2)
    remote = Remote()
    remote.partial = True
    monkeypatch.setattr(operations, "call_remote", remote)
    first = await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    assert first.status_code == 202 and first.json()["operation"]["status"] == "PARTIAL"
    operation = await operation_for(db_session, quote.id)
    await expire(db_session, operation)
    remote.partial = False
    retry = await client.post(f"/api/quotes/{quote.id}/retry", headers=headers(token))
    assert retry.status_code == 200 and retry.json()["operation"]["id"] == operation.id
    assert retry.json()["status"] == "RESERVED" and remote.reads == 1
    for e in equipment:
        await db_session.refresh(e)
        assert e.is_reserved and e.reservation_operation_id is None


async def test_partial_reservation_can_reverse_only_owned_items(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user, 2)
    remote = Remote()
    remote.partial = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    parent = await operation_for(db_session, quote.id)
    await expire(db_session, parent)
    remote.partial = False
    response = await client.post(
        f"/api/quotes/{quote.id}/reverse", headers=headers(token)
    )
    assert response.status_code == 200 and response.json()["status"] == "DRAFT"
    child = await operation_for(db_session, quote.id)
    assert child.parent_id == parent.id and child.action == "cancel"
    assert len(await operations.items_for(db_session, child)) == 1
    await db_session.refresh(parent)
    assert parent.status == "REVERSED"
    for e in equipment:
        await db_session.refresh(e)
        assert not e.is_reserved and e.reservation_operation_id is None


async def test_unknown_probe_never_releases_or_retries_write(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    operation = await operation_for(db_session, quote.id)
    await expire(db_session, operation)
    remote.unknown = True
    response = await client.post(
        f"/api/quotes/{quote.id}/retry", headers=headers(token)
    )
    assert response.status_code == 202 and remote.writes == 1
    await db_session.refresh(equipment[0])
    assert equipment[0].reservation_operation_id == operation.id


async def test_history_is_owned_and_admin_readable(
    client, db_session, sales_user, admin_user, monkeypatch
):
    user, token = sales_user
    quote, _ = await fixture_quote(db_session, user)
    remote = Remote()
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    admin, admin_token = admin_user
    assert (
        await client.get(
            f"/api/quotes/{quote.id}/history", headers=headers(admin_token)
        )
    ).status_code == 200
    response = await client.post(
        f"/api/quotes/{quote.id}/reconcile", headers=headers(admin_token)
    )
    assert response.status_code == 404
    assert (await client.get(f"/api/quotes/{quote.id}/history")).status_code == 401


@pytest.mark.parametrize(
    "mode", ["global_only", "wrong_operation", "wrong_id", "duplicate_item"]
)
async def test_untrusted_or_incomplete_confirmation_is_pending(
    client, db_session, sales_user, monkeypatch, mode
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user, 2)
    real_client = httpx.AsyncClient

    def handler(request):
        body = json.loads(request.content)
        results = [
            {
                "idGlpi": i["idGlpi"],
                "operationId": body["operationId"],
                "status": "confirmed",
            }
            for i in body["itens"]
        ]
        result = {
            "sucesso": True,
            "operationId": body["operationId"],
            "results": results,
        }
        if mode == "global_only":
            result = {"sucesso": True}
        if mode == "wrong_operation":
            result["operationId"] = "not-this-operation"
        if mode == "wrong_id":
            results[0]["idGlpi"] = "999999"
        if mode == "duplicate_item":
            results[1] = results[0]
        return httpx.Response(200, json=result)

    monkeypatch.setattr(
        operations.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler)),
    )
    response = await client.post(
        f"/api/quotes/{quote.id}/reserve", headers=headers(token)
    )
    assert response.status_code == 202
    for e in equipment:
        await db_session.refresh(e)
        assert e.reservation_operation_id and not e.is_reserved


async def test_other_quote_cannot_claim_equipment_after_timeout(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    second = await create_draft_quote(db_session, user, equipment[0])
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    response = await client.post(
        f"/api/quotes/{second.id}/reserve", headers=headers(token)
    )
    assert response.status_code == 409 and remote.writes == 1


async def test_correlated_conflict_is_terminal_and_not_available(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)

    async def conflict(operation, items, inspection=False):
        return {i.id_glpi: "conflict" for i in items}

    monkeypatch.setattr(operations, "call_remote", conflict)
    response = await client.post(
        f"/api/quotes/{quote.id}/reserve", headers=headers(token)
    )
    assert (
        response.status_code == 409
        and response.json()["operation"]["status"] == "CONFLICT"
    )
    await db_session.refresh(equipment[0])
    assert equipment[0].reservation_operation_id is None and not equipment[0].is_active


async def test_late_result_cannot_overwrite_newer_generation(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    operation = await operation_for(db_session, quote.id)
    old_generation = operation.generation
    operation.generation += 1
    await db_session.commit()
    result = await operations.apply_result(
        db_session,
        operation,
        {equipment[0].id_glpi: "confirmed"},
        False,
        user.id,
        old_generation,
    )
    assert result.status == "PENDING"
    await db_session.refresh(equipment[0])
    await db_session.refresh(quote)
    assert equipment[0].reservation_operation_id and not equipment[0].is_reserved
    assert quote.status == QuoteStatus.DRAFT


async def test_duplicate_local_record_cannot_bypass_glpi_claim(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    duplicate = await create_equipment(
        db_session, id_patrimonio="ALIAS", id_glpi=equipment[0].id_glpi
    )
    other = await create_draft_quote(db_session, user, duplicate)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    response = await client.post(
        f"/api/quotes/{other.id}/reserve", headers=headers(token)
    )
    assert response.status_code == 409 and remote.writes == 1


async def test_partial_cancellation_keeps_items_protected_until_retry(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user, 2)
    remote = Remote()
    monkeypatch.setattr(operations, "call_remote", remote)
    assert (
        await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    ).status_code == 200
    remote.partial = True
    response = await client.post(
        f"/api/quotes/{quote.id}/cancel", headers=headers(token)
    )
    assert (
        response.status_code == 202
        and response.json()["operation"]["status"] == "PARTIAL"
    )
    operation = await operation_for(db_session, quote.id)
    for e in equipment:
        await db_session.refresh(e)
        assert e.reservation_operation_id == operation.id
    await expire(db_session, operation)
    remote.partial = False
    result = await client.post(f"/api/quotes/{quote.id}/retry", headers=headers(token))
    assert result.status_code == 200 and result.json()["status"] == "CANCELED"
    for e in equipment:
        await db_session.refresh(e)
        assert not e.is_reserved and e.reservation_operation_id is None


@pytest.mark.parametrize("present", [True, False])
async def test_import_does_not_overwrite_or_deactivate_pending_equipment(
    client, db_session, sales_user, monkeypatch, present
):
    from datetime import datetime, timezone
    from app.catalog_sync import CatalogSynchronizer
    from test_catalog_sync import dated_payload, source

    user, token = sales_user
    quote, equipment = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    operation = await operation_for(db_session, quote.id)
    payload = dated_payload(
        datetime.now(timezone.utc).isoformat(),
        "RMA",
        equipment[0].id_patrimonio if present else "UNRELATED",
    )
    with source(payload):
        await CatalogSynchronizer().sync(db_session, force=True)
    await db_session.refresh(equipment[0])
    assert equipment[0].is_active and equipment[0].status == "DISPONIVEL NOVO"
    assert equipment[0].reservation_operation_id == operation.id


async def test_old_cached_client_cannot_start_a_new_operation(
    client, db_session, sales_user, monkeypatch
):
    user, token = sales_user
    quote, _ = await fixture_quote(db_session, user)
    remote = Remote()
    monkeypatch.setattr(operations, "call_remote", remote)
    response = await client.post(
        f"/api/quotes/{quote.id}/reserve",
        headers={**headers(token), "X-Lummium-Operations": "0"},
    )
    assert response.status_code == 428 and remote.writes == 0
    assert await operation_for(db_session, quote.id) is None


async def test_background_recovery_only_reads_and_notifies(
    client, db_session, sales_user, monkeypatch
):
    import asyncio

    user, token = sales_user
    quote, _ = await fixture_quote(db_session, user)
    remote = Remote()
    remote.timeout_after_write = True
    monkeypatch.setattr(operations, "call_remote", remote)
    await client.post(f"/api/quotes/{quote.id}/reserve", headers=headers(token))
    operation = await operation_for(db_session, quote.id)
    await expire(db_session, operation)
    notifications = []

    async def notify(value):
        notifications.append(value)

    async def end_cycle(seconds):
        raise asyncio.CancelledError()

    monkeypatch.setattr(operations.asyncio, "sleep", end_cycle)
    sessions = async_sessionmaker(db_session.bind, expire_on_commit=False)
    with pytest.raises(asyncio.CancelledError):
        await operations.reconcile_background(sessions, notify)
    assert remote.writes == 1 and remote.reads == 1
    assert notifications == ["OPERATION_UPDATED"]
    await db_session.refresh(operation)
    assert operation.status == "SUCCEEDED"
