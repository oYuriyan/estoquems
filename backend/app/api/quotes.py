from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import httpx

from app.db.session import get_db
from app.db.models import User, Quote, QuoteItem, Equipment, QuoteStatus
from app.schemas.all import QuoteResponse, QuoteCreate, QuoteUpdate
from app.api.deps import get_current_user

router = APIRouter()

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
    for q in quotes:
        q.items_list = [item.equipment for item in q.items]
        # Pydantic schema will read from the `items` relation if we structure it right, but since the relation is to QuoteItem, 
        # we dynamically assign `items` attribute as a list of equipments to match Pydantic schema.
        setattr(q, 'items', [item.equipment for item in q.items])
        
    return quotes

@router.post("/draft", response_model=QuoteResponse)
async def create_draft(
    quote_in: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
    setattr(quote, 'items', [item.equipment for item in quote.items if item.equipment])
    return quote

@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: str,
    quote_in: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id).options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Apenas propostas em rascunho podem ser editadas livremente.")

    update_data = quote_in.model_dump(exclude_unset=True)
    if "equipment_ids" in update_data:
        eq_ids = update_data.pop("equipment_ids")
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
    setattr(quote, 'items', [item.equipment for item in quote.items if item.equipment])
    return quote

@router.post("/{quote_id}/reserve", response_model=QuoteResponse)
async def reserve_quote(
    quote_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id).options(selectinload(Quote.items).selectinload(QuoteItem.equipment)))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    if quote.status == QuoteStatus.RESERVED:
        raise HTTPException(status_code=400, detail="Proposta já reservada.")
        
    equipments = [item.equipment for item in quote.items if item.equipment]
    
    if not equipments:
        raise HTTPException(status_code=400, detail="A proposta não possui equipamentos.")

    # 1. Verifica e dá lock pessimista nos equipamentos (SELECT FOR UPDATE)
    query = select(Equipment).where(Equipment.id.in_([eq.id for eq in equipments])).with_for_update()
    result = await db.execute(query)
    locked_equipments = result.scalars().all()
    
    if len(locked_equipments) != len(equipments):
        raise HTTPException(status_code=404, detail="Um ou mais equipamentos não foram encontrados no estoque.")
        
    for eq in locked_equipments:
        if eq.is_reserved:
            raise HTTPException(status_code=409, detail=f"O equipamento {eq.id_patrimonio} já está reservado.")
            
    # 3. Atualiza os equipamentos
    for eq in locked_equipments:
        eq.is_reserved = True
        
    quote.status = QuoteStatus.RESERVED
        
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
            res.raise_for_status()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=502, detail=f"Erro ao sincronizar reserva com o n8n/GLPI: {str(e)}")
        
    await db.commit()
    await db.refresh(quote)
    setattr(quote, 'items', locked_equipments)

    # 5. Broadcast websocket para todos os clientes atualizarem a tela silenciosamente
    try:
        await request.app.state.ws_manager.broadcast("RESERVED")
    except Exception:
        pass

    return quote

@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.salesperson_id == current_user.id))
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
    ).options(selectinload(Quote.items).selectinload(QuoteItem.equipment))
    
    result = await db.execute(query)
    quote = result.scalar_one_or_none()
    
    if not quote:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
        
    if quote.status == QuoteStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="A proposta já está cancelada.")
        
    # Libera os equipamentos
    for item in quote.items:
        if item.equipment:
            item.equipment.is_reserved = False
            
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
            # We assume the webhook is /webhook/cancelar_reserva based on the previous git check
            res = await client.post("http://n8n:5678/webhook/cancelar_reserva", json=n8n_payload)
            # We don't raise for status here to guarantee local cleanup if n8n is down, or we could strict rollback.
            # Usually cancellation should be best effort or queued. We'll log or ignore HTTP errors.
    except Exception:
        pass
        
    await db.commit()

    # WebSocket Broadcast
    try:
        await request.app.state.ws_manager.broadcast("CANCELED")
    except Exception:
        pass

    return {"status": "success", "message": "Reserva cancelada e itens devolvidos ao estoque."}
