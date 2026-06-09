from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.session import get_db
from app.db.models import User, Equipment
from app.schemas.all import EquipmentResponse, EquipmentCreate
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=List[EquipmentResponse])
async def get_equipments(
    skip: int = 0, limit: int = 1000, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=EquipmentResponse)
async def create_equipment(
    equipment_in: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verifica se já existe um com mesmo id_patrimonio
    result = await db.execute(select(Equipment).where(Equipment.id_patrimonio == equipment_in.id_patrimonio))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Equipamento com este ID Patrimônio já existe.")
        
    equipment = Equipment(**equipment_in.model_dump())
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    return equipment
