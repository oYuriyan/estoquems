from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import httpx

from app.db.session import get_db
from app.db.models import User, Quote, QuoteItem, Equipment, QuoteStatus
from app.schemas.all import QuoteResponse, QuoteCreate, QuoteUpdate
from app.api.deps import get_current_user
from app.inventory import is_available

router = APIRouter()


class ReservationConflict(Exception):
    pass


def validate_webhook_response(response, reservation=False):
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError('Resposta inválida da integração.')
    # O fluxo existente pode informar conflito com HTTP 200 e um campo "erro".
    if payload.get('erro') or payload.get('error'):
        if reservation:
            raise ReservationConflict()
        raise ValueError('Cancelamento não confirmado pela integração.')
    if payload.get('sucesso') is False or payload.get('success') is False:
        raise ValueError('Operação não confirmada pela integração.')
    confirmed = payload.get('sucesso') is True or payload.get('success') is True
    if not confirmed and not (not reservation and payload.get('mensagem') == 'Reserva cancelada com sucesso'):
        raise ValueError('Integração não retornou confirmação da operação.')


async def validate_equipment_ids(db: AsyncSession, equipment_ids: List[str]):
    if len(set(equipment_ids)) != len(equipment_ids):
        raise HTTPException(status_code=422, detail="Um equipamento não pode aparecer duas vezes na mesma proposta.")
    if equipment_ids:
        found = (await db.execute(select(Equipment.id).where(Equipment.id.in_(equipment_ids)))).scalars().all()
        if len(found) != len(equipment_ids):
            raise HTTPException(status_code=404, detail="Um ou mais equipamentos não foram encontrados.")

@router.get("/", response_model=List[QuoteResponse])
async def get_quotes(
    skip: int = 0, limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Apenas propostas do próprio usuário de vendas
    query = select(Quote).where(Quote.salesperson_id == current_user.id).options(
        selectinload(Quote.items).selectinload(QuoteItem.equipment)
    ).offset(skip).limit(limit)
    
    result = await db.execute(query)
    quotes = result.scalars().all()
    
    # Adaptar para o response model (montar a lista items com os equipamentos)
    responses = []
    for q in quotes:
        q_dict = q.__dict__.copy()
        q_dict["items"] = [item.equipment for item in q.items if item.equipment]
        responses.append(QuoteResponse.model_validate(q_dict))
        
    return responses

@router.post("/draft", response_model=QuoteResponse)
async def create_draft(
    quote_in: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await validate_equipment_ids(db, quote_in.equipment_ids)
    quote_data = quote_in.model_dump(exclude={"equipment_ids"})
    quote = Quote(**quote_data, salesperson_id=current_user.id, status=QuoteStatus.DRAFT)
    db.add(quote)
    await db.flush()
    
    if quote_in.equipment_ids:
        for eq_id in quote_in.equipment_ids:
            db.add(QuoteItem(quote_id=quote.id, equipment_id=eq_id))
            
    await db.commit()
    await db.refresh(quote)
    
    # Reload with items
    result = await db.execute(select(Quote).where(Quote.id == quote.id).options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one()
    # Retorna o modelo Pydantic construindo o dict
    q_dict = quote.__dict__.copy()
    q_dict["items"] = [item.equipment for item in quote.items if item.equipment]
    return QuoteResponse.model_validate(q_dict)

@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: str,
    quote_in: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id).with_for_update().options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Apenas propostas em rascunho podem ser editadas livremente.")

    update_data = quote_in.model_dump(exclude_unset=True)
    if "equipment_ids" in update_data:
        eq_ids = update_data.pop("equipment_ids")
        if eq_ids is None:
            raise HTTPException(status_code=422, detail="A lista de equipamentos não pode ser nula.")
        await validate_equipment_ids(db, eq_ids)
        # Remove old
        for item in quote.items:
            await db.delete(item)
        await db.flush()
        # Add new
        for eq_id in eq_ids:
            db.add(QuoteItem(quote_id=quote.id, equipment_id=eq_id))

    for field, value in update_data.items():
        setattr(quote, field, value)

    await db.commit()
    await db.refresh(quote)
    
    result = await db.execute(select(Quote).where(Quote.id == quote.id).options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one()
    q_dict = quote.__dict__.copy()
    q_dict["items"] = [item.equipment for item in quote.items if item.equipment]
    return QuoteResponse.model_validate(q_dict)

@router.post("/{quote_id}/reserve", response_model=QuoteResponse)
async def reserve_quote(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id).with_for_update().options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Somente propostas em rascunho podem ser reservadas.")
        
    equipments = [item.equipment for item in quote.items if item.equipment]
    
    if not equipments:
        raise HTTPException(status_code=400, detail="A proposta não possui equipamentos.")

    # 1. Verifica e dá lock pessimista nos equipamentos (SELECT FOR UPDATE)
    query = select(Equipment).where(Equipment.id.in_([eq.id for eq in equipments])).order_by(Equipment.id).with_for_update().execution_options(populate_existing=True)
    result = await db.execute(query)
    locked_equipments = result.scalars().all()
    
    if len(locked_equipments) != len(equipments):
        raise HTTPException(status_code=404, detail="Um ou mais equipamentos não foram encontrados no estoque.")
        
    for eq in locked_equipments:
        if not is_available(eq):
            raise HTTPException(status_code=409, detail=f"O equipamento {eq.id_patrimonio} não está disponível para reserva.")
            
    # 3. Atualiza os equipamentos
    for eq in locked_equipments:
        eq.is_reserved = True
        
    quote.status = QuoteStatus.RESERVED
    quote.reserved_at = datetime.now(timezone.utc)
        
    # 4. Chama o webhook original do n8n para espelhar a regra de negócio
    n8n_payload = {
        "propostaId": quote.id,
        "nomeProposta": quote.name,
        "cliente": quote.client_name or 'Não informado',
        "validadeDias": quote.validity_days,
        "vendedor": current_user.name,
        "itens": [
            {
                "idPatrimonio": eq.id_patrimonio,
                "numeroSerie": eq.numero_serie,
                "modelo": eq.modelo,
                "statusOriginal": eq.status,
                "idGlpi": eq.id_glpi
            } for eq in locked_equipments
        ]
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post("http://n8n:5678/webhook/reservar_ativos", json=n8n_payload)
            validate_webhook_response(res, reservation=True)
    except ReservationConflict:
        await db.rollback()
        raise HTTPException(status_code=409, detail="O GLPI informou que um dos equipamentos já está reservado. Atualize a proposta.")
    except Exception as e:
        import logging
        logging.error(f"Falha ao notificar N8N: {str(e)}")
        # GLPI is the single source of truth, MUST rollback if n8n fails.
        await db.rollback()
        raise HTTPException(
            status_code=502,
            detail="Erro ao comunicar com o sistema do GLPI para validar a reserva. Tente novamente."
        )
        
    confirmed_at = datetime.now(timezone.utc)
    for equipment in locked_equipments:
        equipment.inventory_confirmed_at = confirmed_at
    await db.commit()
    await db.refresh(quote)

    # 5. Broadcast websocket para todos os clientes atualizarem a tela silenciosamente
    try:
        await request.app.state.ws_manager.broadcast("RESERVED")
    except Exception:
        pass

    for equipment in locked_equipments:
        await db.refresh(equipment)
    q_dict = quote.__dict__.copy()
    q_dict["items"] = locked_equipments
    return QuoteResponse.model_validate(q_dict)

@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id).with_for_update())
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    if quote.status == QuoteStatus.RESERVED:
        raise HTTPException(status_code=400, detail="Não é possível excluir uma proposta reservada. Cancele a reserva primeiro.")
        
    await db.delete(quote)
    await db.commit()
    return {"status": "success"}

@router.post("/{quote_id}/cancel")
async def cancel_quote(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Quote).where(
        Quote.id == quote_id, 
        Quote.salesperson_id == current_user.id
    ).with_for_update().options(selectinload(Quote.items).selectinload(QuoteItem.equipment))
    
    result = await db.execute(query)
    quote = result.scalar_one_or_none()
    
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
        
    if quote.status != QuoteStatus.RESERVED:
        raise HTTPException(status_code=400, detail="Somente uma proposta reservada pode ter sua reserva cancelada.")

    equipment_ids = [item.equipment_id for item in quote.items]
    equipments = (await db.execute(
        select(Equipment).where(Equipment.id.in_(equipment_ids)).order_by(Equipment.id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalars().all()

    # Não libera uma reserva caso existam registros antigos conflitantes.
    other_reservation = await db.execute(
        select(QuoteItem.id).join(Quote).where(
            QuoteItem.equipment_id.in_(equipment_ids),
            Quote.status == QuoteStatus.RESERVED, Quote.id != quote.id,
        ).limit(1)
    )
    if other_reservation.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Há outra reserva para estes equipamentos. Solicite a conferência do administrador.")
        
    # Libera os equipamentos
    for equipment in equipments:
        equipment.is_reserved = False
            
    quote.status = QuoteStatus.CANCELED
    
    # Notifica o n8n do cancelamento
    n8n_payload = {
        "propostaId": quote.id,
        "vendedor": current_user.name,
        "itens": [
            {
                "idPatrimonio": i.equipment.id_patrimonio,
                "idGlpi": i.equipment.id_glpi,
                "statusOriginal": i.equipment.status
            } for i in quote.items if i.equipment
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post("http://n8n:5678/webhook/cancelar_reserva", json=n8n_payload)
            validate_webhook_response(res)
    except Exception as e:
        import logging
        logging.error(f"Falha ao notificar N8N sobre o cancelamento da reserva {quote.id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=502, detail="Não foi possível confirmar o cancelamento no GLPI. A reserva foi mantida; tente novamente.")
        
    confirmed_at = datetime.now(timezone.utc)
    for equipment in equipments:
        equipment.inventory_confirmed_at = confirmed_at
        equipment.is_active = True
    await db.commit()

    # WebSocket Broadcast
    try:
        await request.app.state.ws_manager.broadcast("CANCELED")
    except Exception:
        pass

    return {"status": "success", "message": "Reserva cancelada e itens devolvidos ao estoque."}
