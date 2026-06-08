from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from app.db.session import get_db
from app.db.models import User, Quote, QuoteItem, Equipment, EquipmentStatus, QuoteStatus
from app.schemas.all import QuoteResponse, QuoteCreate
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

@router.post("/", response_model=QuoteResponse)
async def create_quote(
    quote_in: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verifica e dá lock pessimista nos equipamentos (SELECT FOR UPDATE)
    query = select(Equipment).where(Equipment.id.in_(quote_in.equipment_ids)).with_for_update()
    result = await db.execute(query)
    equipments = result.scalars().all()
    
    if len(equipments) != len(quote_in.equipment_ids):
        raise HTTPException(status_code=404, detail="Um ou mais equipamentos não foram encontrados.")
        
    for eq in equipments:
        if eq.status != EquipmentStatus.AVAILABLE:
            raise HTTPException(status_code=409, detail=f"O equipamento {eq.id_patrimonio} não está disponível.")
            
    # 2. Cria a proposta
    quote_data = quote_in.model_dump(exclude={"equipment_ids"})
    quote = Quote(**quote_data, salesperson_id=current_user.id)
    db.add(quote)
    await db.flush() # obtemos o ID da quote
    
    # 3. Associa os itens
    for eq in equipments:
        q_item = QuoteItem(quote_id=quote.id, equipment_id=eq.id)
        db.add(q_item)
        
    await db.commit()
    await db.refresh(quote)
    setattr(quote, 'items', equipments)
    return quote
