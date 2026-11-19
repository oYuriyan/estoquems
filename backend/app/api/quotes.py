from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.db.models import User, UserRole, Quote, QuoteItem, Equipment, QuoteStatus
from app.db.operations import QuoteOperation, OperationEvent
from app.schemas.all import QuoteResponse, QuoteCreate, QuoteUpdate
from app.api.deps import get_current_user
from app.services import operations

# Existing integration tests patch this module's HTTP client.
from app.services.operations import httpx as httpx

__all__ = ["router", "httpx"]
router = APIRouter()


def require_current_client(request):
    if request.headers.get("X-Lummium-Operations") != "1":
        raise HTTPException(
            428,
            detail="A aplicação foi atualizada. Recarregue a página antes de operar reservas.",
        )


async def owned(db, quote_id, user, read_only=False):
    query = (
        select(Quote)
        .where(Quote.id == quote_id)
        .options(selectinload(Quote.items).selectinload(QuoteItem.equipment))
    )
    if not (read_only and user.role == UserRole.ADMIN):
        query = query.where(Quote.salesperson_id == user.id)
    quote = (
        await db.execute(query.execution_options(populate_existing=True))
    ).scalar_one_or_none()
    if not quote:
        raise HTTPException(404, detail="Proposta não encontrada.")
    return quote


async def serialize(db, quote):
    operation = await operations.latest(db, quote.id)
    return QuoteResponse.model_validate(
        {
            **quote.__dict__,
            "items": [i.equipment for i in quote.items if i.equipment],
            "operation": await operations.view(db, operation),
        }
    )


async def validate_equipment_ids(db, equipment_ids):
    if len(set(equipment_ids)) != len(equipment_ids):
        raise HTTPException(
            422, detail="Um equipamento não pode aparecer duas vezes na mesma proposta."
        )
    if equipment_ids:
        found = (
            (
                await db.execute(
                    select(Equipment.id).where(Equipment.id.in_(equipment_ids))
                )
            )
            .scalars()
            .all()
        )
        if len(found) != len(equipment_ids):
            raise HTTPException(
                404, detail="Um ou mais equipamentos não foram encontrados."
            )


@router.get("/", response_model=List[QuoteResponse])
async def get_quotes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quotes = (
        (
            await db.execute(
                select(Quote)
                .where(Quote.salesperson_id == current_user.id)
                .options(selectinload(Quote.items).selectinload(QuoteItem.equipment))
                .offset(skip)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [await serialize(db, q) for q in quotes]


@router.post("/draft", response_model=QuoteResponse)
async def create_draft(
    quote_in: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await validate_equipment_ids(db, quote_in.equipment_ids)
    quote = Quote(
        **quote_in.model_dump(exclude={"equipment_ids"}),
        salesperson_id=current_user.id,
        status=QuoteStatus.DRAFT
    )
    db.add(quote)
    await db.flush()
    for eq_id in quote_in.equipment_ids:
        db.add(QuoteItem(quote_id=quote.id, equipment_id=eq_id))
    await db.commit()
    return await serialize(db, await owned(db, quote.id, current_user))


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: str,
    quote_in: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await owned(db, quote_id, current_user)
    quote = await operations.locked_quote(db, quote_id)
    await operations.ensure_editable(db, quote_id)
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(
            400, detail="Apenas propostas em rascunho podem ser editadas livremente."
        )
    data = quote_in.model_dump(exclude_unset=True)
    if "equipment_ids" in data:
        ids = data.pop("equipment_ids")
        if ids is None:
            raise HTTPException(
                422, detail="A lista de equipamentos não pode ser nula."
            )
        await validate_equipment_ids(db, ids)
        old = (
            (await db.execute(select(QuoteItem).where(QuoteItem.quote_id == quote.id)))
            .scalars()
            .all()
        )
        for item in old:
            await db.delete(item)
        await db.flush()
        for eq_id in ids:
            db.add(QuoteItem(quote_id=quote.id, equipment_id=eq_id))
    for key, value in data.items():
        setattr(quote, key, value)
    await db.commit()
    return await serialize(db, await owned(db, quote_id, current_user))


async def operation_response(db, quote_id, user, operation, request):
    await db.refresh(operation)
    try:
        await request.app.state.ws_manager.broadcast("OPERATION_UPDATED")
    except Exception:
        pass
    if operation.status in operations.UNRESOLVED:
        return JSONResponse(
            status_code=202,
            content=jsonable_encoder(
                {
                    "detail": {
                        "code": "operation_pending",
                        "message": operation.message,
                    },
                    "operation": await operations.view(db, operation),
                }
            ),
        )
    if operation.status == "CONFLICT":
        return JSONResponse(
            status_code=409,
            content=jsonable_encoder(
                {
                    "detail": {
                        "code": "operation_conflict",
                        "message": operation.message,
                    },
                    "operation": await operations.view(db, operation),
                }
            ),
        )
    return await serialize(db, await owned(db, quote_id, user))


@router.post("/{quote_id}/reserve", response_model=QuoteResponse)
async def reserve_quote(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_current_client(request)
    quote = await owned(db, quote_id, current_user)
    operation, created = await operations.start(db, quote, current_user, "reserve")
    if created:
        operation = await operations.run(db, operation, current_user.id)
    return await operation_response(db, quote_id, current_user, operation, request)


@router.post("/{quote_id}/cancel", response_model=QuoteResponse)
async def cancel_quote(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_current_client(request)
    quote = await owned(db, quote_id, current_user)
    operation, created = await operations.start(db, quote, current_user, "cancel")
    if created:
        operation = await operations.run(db, operation, current_user.id)
    return await operation_response(db, quote_id, current_user, operation, request)


async def current_pending(db, quote_id, user):
    await owned(db, quote_id, user)
    operation = await operations.latest(db, quote_id)
    if not operation or operation.status not in operations.UNRESOLVED:
        raise HTTPException(409, detail="Esta proposta não possui operação pendente.")
    return operation


@router.post("/{quote_id}/reconcile", response_model=QuoteResponse)
async def reconcile(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_current_client(request)
    operation = await current_pending(db, quote_id, current_user)
    operation = await operations.run(db, operation, current_user.id, inspection=True)
    return await operation_response(db, quote_id, current_user, operation, request)


@router.post("/{quote_id}/retry", response_model=QuoteResponse)
async def retry(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_current_client(request)
    operation = await current_pending(db, quote_id, current_user)
    operation = await operations.run(db, operation, current_user.id, inspection=True)
    if operation.status in operations.UNRESOLVED and not operations.busy(operation):
        operation = await operations.run(db, operation, current_user.id)
    return await operation_response(db, quote_id, current_user, operation, request)


@router.post("/{quote_id}/reverse", response_model=QuoteResponse)
async def reverse(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_current_client(request)
    operation = await current_pending(db, quote_id, current_user)
    operation = await operations.reverse(db, operation, current_user)
    return await operation_response(db, quote_id, current_user, operation, request)


@router.get("/{quote_id}/history")
async def history(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await owned(db, quote_id, current_user, read_only=True)
    rows = (
        (
            await db.execute(
                select(QuoteOperation)
                .where(QuoteOperation.quote_id == quote_id)
                .order_by(QuoteOperation.created_at, QuoteOperation.id)
            )
        )
        .scalars()
        .all()
    )
    result = []
    for operation in rows:
        data = await operations.view(db, operation)
        events = (
            await db.execute(
                select(OperationEvent, User.name)
                .outerjoin(User, OperationEvent.actor_id == User.id)
                .where(OperationEvent.operation_id == operation.id)
                .order_by(OperationEvent.created_at, OperationEvent.id)
            )
        ).all()
        data["events"] = [
            {
                "kind": e.kind,
                "actor": name or "Conferência automática",
                "status": e.status,
                "created_at": e.created_at,
                "data": e.data,
            }
            for e, name in events
        ]
        result.append(data)
    return result


@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await owned(db, quote_id, current_user)
    quote = await operations.locked_quote(db, quote_id)
    await operations.ensure_editable(db, quote_id, history=True)
    if quote.status == QuoteStatus.RESERVED:
        raise HTTPException(
            400,
            detail="Não é possível excluir uma proposta reservada. Cancele a reserva primeiro.",
        )
    await db.delete(quote)
    await db.commit()
    return {"status": "success"}
