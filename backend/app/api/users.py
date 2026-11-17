from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.session import get_db
from app.db.models import User
from app.schemas.all import UserResponse, UserCreate
from app.core.security import get_password_hash
from app.api.deps import get_current_active_superuser

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
async def read_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users

@router.post("/", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="O email já está em uso.")
    
    user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Você não pode excluir a si mesmo.")
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    await db.delete(user)
    await db.commit()
    return None
