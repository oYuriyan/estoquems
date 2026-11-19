"""Durable reservation operations. Network effects occur only after the claim is committed."""

from datetime import datetime, timezone, timedelta
import asyncio
import httpx
from fastapi import HTTPException
from sqlalchemy import select
from app.db.models import Quote, QuoteItem, Equipment, QuoteStatus
from app.db.operations import QuoteOperation, OperationItem, OperationEvent
from app.catalog_status import require_fresh_inventory
from app.inventory import is_available

UNRESOLVED = ("PENDING", "PARTIAL")
LEASE_SECONDS = 90


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return (
        value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
    )


def busy(operation):
    return operation.lease_until is not None and utc(operation.lease_until) > now()


async def latest(db, quote_id):
    return (
        await db.execute(
            select(QuoteOperation)
            .where(QuoteOperation.quote_id == quote_id)
            .order_by(QuoteOperation.created_at.desc(), QuoteOperation.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def items_for(db, operation):
    return (
        (
            await db.execute(
                select(OperationItem)
                .where(OperationItem.operation_id == operation.id)
                .order_by(OperationItem.equipment_id)
            )
        )
        .scalars()
        .all()
    )


async def event(db, operation, actor_id, kind):
    items = await items_for(db, operation)
    db.add(
        OperationEvent(
            operation_id=operation.id,
            actor_id=actor_id,
            kind=kind,
            status=operation.status,
            data={
                "items": [{"id_glpi": i.id_glpi, "status": i.status} for i in items],
                "attempt": operation.attempts,
            },
        )
    )


async def view(db, operation):
    if operation is None:
        return None
    items = await items_for(db, operation)
    return {
        "id": operation.id,
        "quote_id": operation.quote_id,
        "action": operation.action,
        "status": operation.status,
        "parent_id": operation.parent_id,
        "actor_id": operation.actor_id,
        "attempts": operation.attempts,
        "message": operation.message,
        "created_at": operation.created_at,
        "updated_at": operation.updated_at,
        "next_check_at": operation.lease_until if busy(operation) else None,
        "items": [
            {
                "equipment_id": i.equipment_id,
                "id_glpi": i.id_glpi,
                "serial": i.serial,
                "status": i.status,
                "message": i.message,
            }
            for i in items
        ],
    }


async def ensure_editable(db, quote_id, history=False):
    operation = await latest(db, quote_id)
    if operation and (operation.status in UNRESOLVED or history):
        raise HTTPException(
            409,
            detail={
                "code": "operation_pending" if not history else "history_preserved",
                "message": (
                    "Confira a operação pendente antes de alterar a proposta."
                    if not history
                    else "Esta proposta possui histórico de operações e deve ser preservada."
                ),
            },
        )


async def locked_quote(db, quote_id):
    return (
        await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


async def lock_equipment(db, ids):
    return (
        (
            await db.execute(
                select(Equipment)
                .where(Equipment.id.in_(ids))
                .order_by(Equipment.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


async def start(db, quote, actor, action):
    quote = await locked_quote(db, quote.id)
    previous = await latest(db, quote.id)
    if previous and previous.status in UNRESOLVED:
        return previous, False
    if quote.status != (
        QuoteStatus.DRAFT if action == "reserve" else QuoteStatus.RESERVED
    ):
        raise HTTPException(
            400, detail="A proposta não está no estado necessário para esta operação."
        )
    ids = (
        (
            await db.execute(
                select(QuoteItem.equipment_id).where(QuoteItem.quote_id == quote.id)
            )
        )
        .scalars()
        .all()
    )
    if not ids:
        raise HTTPException(400, detail="A proposta não possui equipamentos.")
    if action == "reserve":
        await require_fresh_inventory(db)
    requested = (
        (await db.execute(select(Equipment).where(Equipment.id.in_(ids))))
        .scalars()
        .all()
    )
    canonical = (
        (
            await db.execute(
                select(Equipment)
                .where(Equipment.id_glpi.in_([e.id_glpi for e in requested]))
                .order_by(Equipment.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    equipment = [e for e in canonical if e.id in ids]
    if action == "reserve" and any(
        e.reservation_operation_id or e.is_reserved for e in canonical
    ):
        raise HTTPException(
            409,
            detail="Um equipamento GLPI já está reservado ou aguardando conferência.",
        )
    if len(equipment) != len(ids):
        raise HTTPException(
            409, detail="Os equipamentos da proposta precisam ser conferidos."
        )
    if len({e.id_glpi for e in equipment}) != len(equipment):
        raise HTTPException(
            409, detail="Há equipamentos com ID GLPI duplicado; confira o catálogo."
        )
    for e in equipment:
        if e.reservation_operation_id or (action == "reserve" and not is_available(e)):
            raise HTTPException(
                409, detail="Um equipamento está reservado ou aguardando conferência."
            )
        if (
            not str(e.id_glpi).isdigit()
            or int(e.id_glpi) <= 0
            or str(int(e.id_glpi)) != str(e.id_glpi)
        ):
            raise HTTPException(409, detail="Equipamento sem ID GLPI válido.")
    if action == "cancel":
        conflicting = (
            await db.execute(
                select(QuoteItem.id)
                .join(Quote)
                .where(
                    QuoteItem.equipment_id.in_([e.id for e in canonical]),
                    Quote.status == QuoteStatus.RESERVED,
                    Quote.id != quote.id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if conflicting:
            raise HTTPException(
                409, detail="Existe outra reserva local para estes equipamentos."
            )
    operation = QuoteOperation(
        quote_id=quote.id,
        actor_id=actor.id,
        action=action,
        status="PENDING",
        message="Operação registrada; aguardando confirmação.",
    )
    db.add(operation)
    await db.flush()
    for e in equipment:
        e.reservation_operation_id = operation.id
        db.add(
            OperationItem(
                operation_id=operation.id,
                equipment_id=e.id,
                id_glpi=e.id_glpi,
                serial=e.numero_serie,
                original_status=e.status,
                status="pending",
            )
        )
    await db.flush()
    await event(db, operation, actor.id, "created")
    await db.commit()
    return operation, True


async def call_remote(operation, items, inspection=False):
    path = (
        "consultar_reservas"
        if inspection
        else "reservar_ativos" if operation.action == "reserve" else "cancelar_reserva"
    )
    payload = {
        "operationId": operation.id,
        "propostaId": operation.quote_id,
        "itens": [
            {
                "idGlpi": i.id_glpi,
                "numeroSerie": i.serial,
                "statusOriginal": i.original_status,
            }
            for i in items
        ],
    }
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        response = await client.post("http://n8n:5678/webhook/" + path, json=payload)
        response.raise_for_status()
        body = response.json()
    if (
        not isinstance(body, dict)
        or body.get("operationId") != operation.id
        or not isinstance(body.get("results"), list)
    ):
        raise ValueError("Invalid operation correlation")
    rows = body["results"]
    expected = {str(i.id_glpi) for i in items}
    if (
        len(rows) != len(items)
        or any(not isinstance(r, dict) for r in rows)
        or {str(r.get("idGlpi")) for r in rows} != expected
    ):
        raise ValueError("Invalid item correlation")
    allowed = (
        {"available", "reserved_by_quote", "reserved_other", "unavailable", "unknown"}
        if inspection
        else {"confirmed", "conflict", "pending"}
    )
    key = "state" if inspection else "status"
    if any(
        r.get(key) not in allowed or r.get("operationId") != operation.id for r in rows
    ):
        raise ValueError("Invalid item confirmation")
    return {str(row["idGlpi"]): row[key] for row in rows}


async def apply_result(db, operation, results, inspection, actor_id, generation):
    operation = (
        await db.execute(
            select(QuoteOperation)
            .where(QuoteOperation.id == operation.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    if operation.generation != generation or operation.status not in UNRESOLVED:
        await db.commit()
        return operation
    quote = await locked_quote(db, operation.quote_id)
    items = await items_for(db, operation)
    equipment = {
        e.id: e for e in await lock_equipment(db, [i.equipment_id for i in items])
    }
    for item in items:
        outcome = results.get(item.id_glpi, "unknown" if inspection else "pending")
        if inspection:
            item.observed_state = outcome
            confirmed = outcome == (
                "reserved_by_quote" if operation.action == "reserve" else "available"
            )
            conflict = outcome in ("reserved_other", "unavailable")
            item.status = (
                "confirmed" if confirmed else "conflict" if conflict else "pending"
            )
        else:
            item.status = outcome
        item.message = {
            "confirmed": "Estado confirmado no GLPI",
            "conflict": "Equipamento em conflito na origem",
            "pending": "Aguardando conferência no GLPI",
        }[item.status]
        e = equipment[item.equipment_id]
        if item.status == "confirmed":
            e.is_reserved = operation.action == "reserve"
            e.inventory_confirmed_at = now()
            e.is_active = True
        elif item.status == "conflict":
            e.is_active = False
            e.inventory_confirmed_at = now()
    statuses = [i.status for i in items]
    if all(s == "confirmed" for s in statuses):
        operation.status = "SUCCEEDED"
        operation.message = (
            "Reserva confirmada."
            if operation.action == "reserve"
            else "Liberação confirmada."
        )
        quote.status = (
            QuoteStatus.RESERVED
            if operation.action == "reserve"
            else QuoteStatus.DRAFT if operation.parent_id else QuoteStatus.CANCELED
        )
        if operation.action == "reserve":
            quote.reserved_at = now()
        if operation.parent_id:
            parent = await db.get(QuoteOperation, operation.parent_id)
            parent.status = "REVERSED"
            parent.message = "Reserva parcial desfeita e conferida."
        for e in equipment.values():
            if e.reservation_operation_id == operation.id:
                e.reservation_operation_id = None
    elif all(s == "conflict" for s in statuses):
        operation.status = "CONFLICT"
        operation.message = "A operação encontrou conflito no GLPI."
        if operation.parent_id:
            parent = await db.get(QuoteOperation, operation.parent_id)
            parent.status = "CONFLICT"
            parent.message = "A liberação da reserva parcial precisa de conferência."
        for e in equipment.values():
            if e.reservation_operation_id == operation.id:
                e.reservation_operation_id = None
    else:
        operation.status = "PARTIAL" if "confirmed" in statuses else "PENDING"
        operation.message = (
            "Alguns itens foram confirmados; confira os restantes."
            if operation.status == "PARTIAL"
            else "O resultado ainda precisa ser conferido no GLPI."
        )
    # A known, complete response ends this request; uncertain effects retain the quiet period.
    if "pending" not in statuses or (
        inspection and all(value != "unknown" for value in results.values())
    ):
        operation.lease_until = None
    await event(
        db,
        operation,
        actor_id,
        "inspection_result" if inspection else "result_received",
    )
    await db.commit()
    return operation


async def run(db, operation, actor_id, inspection=False):
    operation = (
        await db.execute(
            select(QuoteOperation)
            .where(QuoteOperation.id == operation.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    if operation.status not in UNRESOLVED or busy(operation):
        await db.commit()
        return operation
    items = await items_for(db, operation)
    operation.lease_until = now() + timedelta(seconds=LEASE_SECONDS)
    operation.generation += 1
    generation = operation.generation
    operation.attempts += 0 if inspection else 1
    if not inspection:
        for item in items:
            item.observed_state = None
    await event(
        db,
        operation,
        actor_id,
        "inspection_started" if inspection else "attempt_started",
    )
    await db.commit()
    try:
        result = await call_remote(operation, items, inspection)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        # Never log remote payloads/headers. The committed claim survives this failure and restart.
        operation = (
            await db.execute(
                select(QuoteOperation)
                .where(QuoteOperation.id == operation.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
        if operation.generation != generation or operation.status not in UNRESOLVED:
            await db.commit()
            return operation
        operation.message = (
            "Sem confirmação completa. Os itens continuam protegidos até a conferência."
        )
        await event(db, operation, actor_id, "confirmation_unknown")
        await db.commit()
        return operation
    return await apply_result(db, operation, result, inspection, actor_id, generation)


async def reverse(db, operation, actor):
    operation = await run(db, operation, actor.id, inspection=True)
    if (
        busy(operation)
        or operation.action != "reserve"
        or operation.status not in UNRESOLVED
    ):
        raise HTTPException(
            409, detail="Aguarde a conferência da reserva antes de desfazer."
        )
    operation = (
        await db.execute(
            select(QuoteOperation)
            .where(QuoteOperation.id == operation.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    if busy(operation) or operation.status not in UNRESOLVED:
        raise HTTPException(
            409, detail="Outra conferência está em andamento; atualize a proposta."
        )
    observed_items = await items_for(db, operation)
    raw = {item.id_glpi: item.observed_state for item in observed_items}
    if any(
        value not in ("available", "reserved_by_quote", "reserved_other", "unavailable")
        for value in raw.values()
    ):
        raise HTTPException(
            409, detail="Ainda há itens sem estado conhecido; mantenha a conferência."
        )
    quote = await locked_quote(db, operation.quote_id)
    old_items = await items_for(db, operation)
    equipment = {
        e.id: e for e in await lock_equipment(db, [i.equipment_id for i in old_items])
    }
    owned = [i for i in old_items if raw[i.id_glpi] == "reserved_by_quote"]
    for item in old_items:
        e = equipment[item.equipment_id]
        if raw[item.id_glpi] != "reserved_by_quote":
            e.is_reserved = raw[item.id_glpi] == "reserved_other"
            e.is_active = raw[item.id_glpi] == "available"
            e.inventory_confirmed_at = now()
    if not owned:
        operation.status = "REVERSED"
        operation.message = (
            "Conferência concluída: nenhuma reserva desta proposta permanece no GLPI."
        )
        for e in equipment.values():
            if e.reservation_operation_id == operation.id:
                e.reservation_operation_id = None
        await event(db, operation, actor.id, "reverse_without_write")
        await db.commit()
        return operation
    child = QuoteOperation(
        quote_id=quote.id,
        actor_id=actor.id,
        parent_id=operation.id,
        action="cancel",
        status="PENDING",
        message="Desfazendo somente itens confirmados desta proposta.",
    )
    db.add(child)
    await db.flush()
    owned_ids = {i.equipment_id for i in owned}
    for item in old_items:
        e = equipment[item.equipment_id]
        if e.reservation_operation_id == operation.id:
            e.reservation_operation_id = child.id if e.id in owned_ids else None
        if e.id in owned_ids:
            db.add(
                OperationItem(
                    operation_id=child.id,
                    equipment_id=e.id,
                    id_glpi=item.id_glpi,
                    serial=item.serial,
                    original_status=item.original_status,
                    status="pending",
                )
            )
    operation.status = "REVERSING"
    await db.flush()
    await event(db, operation, actor.id, "reverse_requested")
    await event(db, child, actor.id, "created")
    await db.commit()
    return await run(db, child, actor.id)


async def reconcile_background(session_factory, notify=None):
    while True:
        try:
            async with session_factory() as db:
                ids = (
                    (
                        await db.execute(
                            select(QuoteOperation.id)
                            .where(QuoteOperation.status.in_(UNRESOLVED))
                            .order_by(QuoteOperation.created_at)
                            .limit(50)
                        )
                    )
                    .scalars()
                    .all()
                )
                for operation_id in ids:
                    operation = await db.get(
                        QuoteOperation, operation_id, populate_existing=True
                    )
                    if operation and not busy(operation):
                        previous = operation.status
                        result = await run(db, operation, None, inspection=True)
                        if notify and result.status != previous:
                            await notify("OPERATION_UPDATED")
        except asyncio.CancelledError:
            raise
        except Exception:
            # Leave durable claims intact; retry only read-only reconciliation next cycle.
            pass
        await asyncio.sleep(30)
