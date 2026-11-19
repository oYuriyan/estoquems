from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey, Enum as SQLEnum, JSON
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
    
    token_version = Column(Integer, default=0, server_default='0', nullable=False)
    reset_token_hash = Column(String(64), unique=True, nullable=True)
    reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    reset_requested_at = Column(DateTime(timezone=True), nullable=True)

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
    status = Column(String, default="USADO", nullable=False)
    is_reserved = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    reservation_operation_id = Column(String, ForeignKey("quote_operations.id"), nullable=True, index=True)
    inventory_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    fornecedor = Column(String)
    especificacoes = Column(JSON) # JSON com processador, ram, armazenamento, etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CatalogSyncState(Base):
    __tablename__ = "catalog_sync_state"

    id = Column(Integer, primary_key=True)
    source_updated_at = Column(DateTime(timezone=True), nullable=False)
    fingerprint = Column(String(64), nullable=False)
    synced_at = Column(DateTime(timezone=True), nullable=False)


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

# Register ledger tables for metadata creation and migrations.
from app.db.operations import QuoteOperation as QuoteOperation, OperationItem as OperationItem, OperationEvent as OperationEvent

__all__ = ["Base", "User", "UserRole", "Equipment", "EquipmentStatus", "Quote", "QuoteItem", "QuoteStatus", "CatalogSyncState", "generate_uuid", "QuoteOperation", "OperationItem", "OperationEvent"]
