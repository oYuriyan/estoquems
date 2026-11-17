import asyncio
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.db.session import get_db
from app.db.models import User
from app.core.security import get_password_hash, verify_password
from app.core.recovery_mail import mail_ready, send_reset_email

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
MESSAGE = {'message': 'Se o e-mail estiver cadastrado e ativo, você receberá um link de recuperação. Confira também o spam.'}
class ForgotPassword(BaseModel):
    email: EmailStr = Field(max_length=254)
class ResetPassword(BaseModel):
    token: str = Field(min_length=43, max_length=43, pattern=r'^[A-Za-z0-9_-]+$')
    password: str = Field(min_length=12, max_length=72)
    @field_validator('password')
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode('utf-8')) > 72 or value.isspace():
            raise ValueError('Use uma senha de pelo menos 12 caracteres e até 72 bytes.')
        return value
def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

@router.post('/forgot-password', status_code=202)
@limiter.limit('5/minute')
async def forgot_password(request: Request, body: ForgotPassword, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    started = time.monotonic()
    if not mail_ready():
        raise HTTPException(503, 'Recuperação por e-mail indisponível no momento. Contate o administrador.')
    user = (await db.execute(select(User).where(func.lower(User.email) == str(body.email).lower()).with_for_update())).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if user and user.is_active and (not user.reset_requested_at or now - utc(user.reset_requested_at) >= timedelta(seconds=60)):
        token = secrets.token_urlsafe(32)
        user.reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
        user.reset_expires_at = now + timedelta(minutes=15)
        user.reset_requested_at = now
        await db.commit()
        background.add_task(send_reset_email, user.email, token)
    else:
        await db.rollback()
    await asyncio.sleep(max(0, 0.3 - (time.monotonic() - started)))
    return MESSAGE

@router.post('/reset-password')
@limiter.limit('10/minute')
async def reset_password(request: Request, body: ResetPassword, db: AsyncSession = Depends(get_db)):
    digest = hashlib.sha256(body.token.encode()).hexdigest()
    user = (await db.execute(select(User).where(User.reset_token_hash == digest).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if not user or not user.is_active or not user.reset_expires_at or utc(user.reset_expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(400, 'Link inválido ou expirado. Solicite uma nova recuperação.')
    if verify_password(body.password, user.hashed_password):
        raise HTTPException(400, 'Escolha uma senha diferente da anterior.')
    user.hashed_password = get_password_hash(body.password)
    user.token_version += 1
    user.reset_token_hash = None
    user.reset_expires_at = None
    email = user.email
    await db.commit()
    # Existing sockets only receive catalog invalidation events, but also close them on reset.
    from jose import jwt
    from app.core.config import get_settings
    s = get_settings()
    manager = getattr(request.app.state, 'ws_manager', None)
    for connection in list(manager.active_connections) if manager else []:
        try:
            payload = jwt.decode(connection.query_params.get('token', ''), s.JWT_SECRET_KEY, algorithms=[s.JWT_ALGORITHM])
            if payload.get('sub') == email:
                await connection.close(code=1008)
                manager.disconnect(connection)
        except Exception:
            pass
    return {'message': 'Senha alterada. Entre novamente com sua nova senha.'}
