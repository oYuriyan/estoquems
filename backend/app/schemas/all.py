from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.db.models import UserRole, QuoteStatus

# ── Token ────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# ── User ─────────────────────────────────────────────────────────
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str
    role: Optional[UserRole] = UserRole.SALES

class UserResponse(UserBase):
    id: str
    role: UserRole
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ── Equipment ────────────────────────────────────────────────────
class EquipmentBase(BaseModel):
    id_patrimonio: str
    id_glpi: str
    numero_serie: str
    tipo: str
    marca: str
    modelo: str
    status: str
    is_reserved: bool = False
    is_active: bool = True
    fornecedor: Optional[str] = None
    especificacoes: Dict[str, Any]

class EquipmentCreate(EquipmentBase):
    status: str = "USADO"

class EquipmentResponse(EquipmentBase):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

# ── Quote ────────────────────────────────────────────────────────
class QuoteCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    margin: Optional[str] = None
    validity_days: int = 2
    equipment_ids: List[str] = Field(default_factory=list, description="IDs dos equipamentos (id, não id_patrimonio)")

class QuoteUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    margin: Optional[str] = None
    validity_days: Optional[int] = None
    equipment_ids: Optional[List[str]] = None

class QuoteResponse(BaseModel):
    id: str
    name: str
    client_name: Optional[str]
    margin: Optional[str]
    validity_days: int
    status: QuoteStatus
    salesperson_id: str
    reserved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Detalhes opcionais
    items: List[EquipmentResponse] = []
    
    model_config = {"from_attributes": True}
