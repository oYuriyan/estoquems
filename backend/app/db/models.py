from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import enum
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SALES = "SALES"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.SALES, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relação com propostas que o usuário criou
    quotes = relationship("Quote", back_populates="salesperson")

class EquipmentStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    UNAVAILABLE = "UNAVAILABLE"

class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(String, primary_key=True, default=generate_uuid)
    id_patrimonio = Column(String, unique=True, index=True, nullable=False)
    id_glpi = Column(String, nullable=False)
    numero_serie = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    marca = Column(String, nullable=False)
    modelo = Column(String, nullable=False)
    status = Column(SQLEnum(EquipmentStatus), default=EquipmentStatus.AVAILABLE, nullable=False)
    condicao = Column(String, default="USADO") # NOVO, USADO, etc
    fornecedor = Column(String)
    especificacoes = Column(JSON) # JSON com processador, ram, armazenamento, etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class QuoteStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    RESERVED = "RESERVED"
    EXPIRED = "EXPIRED"
    CANCELED = "CANCELED"
    WON = "WON"

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    client_name = Column(String)
    margin = Column(String)
    validity_days = Column(Integer, default=2)
    status = Column(SQLEnum(QuoteStatus), default=QuoteStatus.DRAFT, nullable=False)
    
    salesperson_id = Column(String, ForeignKey("users.id"), nullable=False)
    salesperson = relationship("User", back_populates="quotes")
    
    reserved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    quote_id = Column(String, ForeignKey("quotes.id"), nullable=False)
    equipment_id = Column(String, ForeignKey("equipments.id"), nullable=False)
    
    quote = relationship("Quote", back_populates="items")
    equipment = relationship("Equipment")
