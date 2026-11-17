from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import User
from app.schemas.all import Token, UserResponse
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    result = await db.execute(select(User).where(func.lower(User.email) == form_data.username.strip().lower()))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Credenciais inválidas ou usuário inativo")
        
    access_token = create_access_token(subject=user.email, token_version=user.token_version)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
